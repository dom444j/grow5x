const { User, Commission, Purchase } = require('../models');
const { toApiNumber } = require('../utils/decimal');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class ReferralTreeService {
  /**
   * Get complete referral tree for a user with specified depth
   * @param {ObjectId} userId - Root user ID
   * @param {number} maxDepth - Maximum depth to traverse (default: 5)
   * @param {boolean} includeStats - Include commission and purchase stats
   * @returns {Object} Referral tree structure
   */
  static async getReferralTree(userId, maxDepth = 5, includeStats = true) {
    const cacheKey = `referral_tree:${userId}:${maxDepth}:${includeStats}`;
    const cacheTTL = 600; // 10 minutes

    try {
      // Try to get from cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get root user
      const rootUser = await User.findById(userId)
        .select('userId email firstName lastName referralCode status createdAt')
        .lean();

      if (!rootUser) {
        throw new Error('Usuario no encontrado');
      }

      // Build tree recursively
      const tree = await this.buildTreeNode(rootUser, 0, maxDepth, includeStats);

      // Calculate tree statistics
      const treeStats = this.calculateTreeStats(tree);

      const result = {
        tree,
        stats: treeStats,
        metadata: {
          rootUserId: userId,
          maxDepth,
          includeStats,
          generatedAt: new Date()
        }
      };

      // Cache the result
      await redis.setex(cacheKey, cacheTTL, JSON.stringify(result));

      return result;

    } catch (error) {
      logger.error('ReferralTreeService.getReferralTree error:', {
        error: error.message,
        userId,
        maxDepth
      });
      throw error;
    }
  }

  /**
   * Build a single tree node with its children
   * @param {Object} user - User object
   * @param {number} currentDepth - Current depth in tree
   * @param {number} maxDepth - Maximum depth to traverse
   * @param {boolean} includeStats - Include stats for this node
   * @returns {Object} Tree node
   */
  static async buildTreeNode(user, currentDepth, maxDepth, includeStats) {
    const node = {
      userId: user._id,
      userIdString: user.userId,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      referralCode: user.referralCode,
      status: user.status,
      createdAt: user.createdAt,
      level: currentDepth,
      children: [],
      stats: null
    };

    // Add stats if requested
    if (includeStats) {
      node.stats = await this.getUserStats(user._id, user.userId);
    }

    // If we haven't reached max depth, get children
    if (currentDepth < maxDepth) {
      const children = await User.find({ referredBy: user._id })
        .select('userId email firstName lastName referralCode status createdAt')
        .lean();

      // Recursively build child nodes
      for (const child of children) {
        const childNode = await this.buildTreeNode(child, currentDepth + 1, maxDepth, includeStats);
        node.children.push(childNode);
      }
    }

    return node;
  }

  /**
   * Get user statistics for tree node
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @param {string} userIdString - User custom userId
   * @returns {Object} User stats
   */
  static async getUserStats(userId, userIdString) {
    try {
      const [commissionStats, purchaseStats, referralCount] = await Promise.all([
        this.getCommissionStats(userId),
        this.getPurchaseStats(userIdString),
        User.countDocuments({ referredBy: userId })
      ]);

      return {
        commissions: commissionStats,
        purchases: purchaseStats,
        directReferrals: referralCount
      };
    } catch (error) {
      logger.error('ReferralTreeService.getUserStats error:', error);
      return {
        commissions: { total: 0, earned: 0, locked: 0 },
        purchases: { total: 0, active: 0, invested: 0 },
        directReferrals: 0
      };
    }
  }

  /**
   * Get commission statistics for user
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @returns {Object} Commission stats
   */
  static async getCommissionStats(userId) {
    try {
      const stats = await Commission.aggregate([
        {
          $match: { earner: userId }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ]);

      const result = {
        total: 0,
        earned: 0,
        locked: 0,
        pending: 0
      };

      stats.forEach(stat => {
        result.total += stat.count;
        if (stat._id === 'unlocked') {
          result.earned = stat.totalAmount || 0;
        } else if (stat._id === 'locked') {
          result.locked = stat.totalAmount || 0;
        } else if (stat._id === 'pending') {
          result.pending = stat.totalAmount || 0;
        }
      });

      return result;
    } catch (error) {
      logger.error('ReferralTreeService.getCommissionStats error:', error);
      return { total: 0, earned: 0, locked: 0, pending: 0 };
    }
  }

  /**
   * Get purchase statistics for user
   * @param {string} userIdString - User custom userId
   * @returns {Object} Purchase stats
   */
  static async getPurchaseStats(userIdString) {
    try {
      const stats = await Purchase.aggregate([
        {
          $match: { userId: userIdString }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      const result = {
        total: 0,
        active: 0,
        completed: 0,
        invested: 0
      };

      stats.forEach(stat => {
        result.total += stat.count;
        result.invested += stat.totalAmount || 0;
        
        if (stat._id === 'ACTIVE') {
          result.active = stat.count;
        } else if (stat._id === 'COMPLETED') {
          result.completed = stat.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('ReferralTreeService.getPurchaseStats error:', error);
      return { total: 0, active: 0, completed: 0, invested: 0 };
    }
  }

  /**
   * Calculate overall tree statistics
   * @param {Object} tree - Tree root node
   * @returns {Object} Tree statistics
   */
  static calculateTreeStats(tree) {
    const stats = {
      totalNodes: 0,
      totalLevels: 0,
      totalCommissions: 0,
      totalInvested: 0,
      activeUsers: 0,
      levelDistribution: {}
    };

    const traverse = (node, level) => {
      stats.totalNodes++;
      stats.totalLevels = Math.max(stats.totalLevels, level + 1);
      
      // Update level distribution
      if (!stats.levelDistribution[level]) {
        stats.levelDistribution[level] = 0;
      }
      stats.levelDistribution[level]++;

      // Add user stats if available
      if (node.stats) {
        stats.totalCommissions += (node.stats.commissions.earned || 0) + (node.stats.commissions.locked || 0);
        stats.totalInvested += node.stats.purchases.invested || 0;
        
        if (node.status === 'ACTIVE') {
          stats.activeUsers++;
        }
      }

      // Traverse children
      node.children.forEach(child => traverse(child, level + 1));
    };

    traverse(tree, 0);

    return stats;
  }

  /**
   * Get referral path from root to specific user
   * @param {ObjectId} rootUserId - Root user ID
   * @param {ObjectId} targetUserId - Target user ID
   * @param {number} maxDepth - Maximum depth to search
   * @returns {Array} Path of user IDs from root to target
   */
  static async getReferralPath(rootUserId, targetUserId, maxDepth = 10) {
    try {
      const path = [];
      let currentUserId = targetUserId;
      let depth = 0;

      while (currentUserId && depth < maxDepth) {
        const user = await User.findById(currentUserId)
          .select('_id referredBy')
          .lean();

        if (!user) break;

        path.unshift(user._id);

        if (user._id.equals(rootUserId)) {
          return path; // Found path to root
        }

        currentUserId = user.referredBy;
        depth++;
      }

      return null; // No path found
    } catch (error) {
      logger.error('ReferralTreeService.getReferralPath error:', error);
      return null;
    }
  }

  /**
   * Get all users at a specific level in referral tree
   * @param {ObjectId} rootUserId - Root user ID
   * @param {number} level - Target level (0 = root, 1 = direct referrals, etc.)
   * @returns {Array} Users at specified level
   */
  static async getUsersAtLevel(rootUserId, level) {
    try {
      if (level === 0) {
        const rootUser = await User.findById(rootUserId)
          .select('userId email firstName lastName referralCode status')
          .lean();
        return rootUser ? [rootUser] : [];
      }

      // Build aggregation pipeline to find users at specific level
      const pipeline = [];
      let currentMatch = { referredBy: rootUserId };

      for (let i = 1; i <= level; i++) {
        if (i === level) {
          // Final level - return these users
          pipeline.push(
            { $match: currentMatch },
            {
              $project: {
                userId: 1,
                email: 1,
                firstName: 1,
                lastName: 1,
                referralCode: 1,
                status: 1,
                level: { $literal: level }
              }
            }
          );
        } else {
          // Intermediate level - get IDs for next iteration
          const users = await User.find(currentMatch).select('_id').lean();
          const userIds = users.map(u => u._id);
          currentMatch = { referredBy: { $in: userIds } };
        }
      }

      if (pipeline.length > 0) {
        return await User.aggregate(pipeline);
      } else {
        const users = await User.find(currentMatch)
          .select('userId email firstName lastName referralCode status')
          .lean();
        return users.map(user => ({ ...user, level }));
      }
    } catch (error) {
      logger.error('ReferralTreeService.getUsersAtLevel error:', error);
      return [];
    }
  }

  /**
   * Clear referral tree cache for user
   * @param {ObjectId} userId - User ID
   */
  static async clearTreeCache(userId) {
    try {
      const pattern = `referral_tree:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('ReferralTreeService.clearTreeCache error:', error);
    }
  }

  /**
   * Get referral tree summary for admin dashboard
   * @param {ObjectId} userId - Root user ID
   * @returns {Object} Tree summary
   */
  static async getTreeSummary(userId) {
    try {
      const tree = await this.getReferralTree(userId, 3, true);
      
      return {
        totalReferrals: tree.stats.totalNodes - 1, // Exclude root
        totalLevels: tree.stats.totalLevels,
        activeReferrals: tree.stats.activeUsers,
        totalCommissions: toApiNumber(tree.stats.totalCommissions),
        totalInvested: toApiNumber(tree.stats.totalInvested),
        levelDistribution: tree.stats.levelDistribution
      };
    } catch (error) {
      logger.error('ReferralTreeService.getTreeSummary error:', error);
      return {
        totalReferrals: 0,
        totalLevels: 0,
        activeReferrals: 0,
        totalCommissions: 0,
        totalInvested: 0,
        levelDistribution: {}
      };
    }
  }
}

module.exports = ReferralTreeService;