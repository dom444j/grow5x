const Cohort = require('../models/Cohort');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

/**
 * Controlador de Cohortes - Gestión de feature flags por batch-id
 */

/**
 * GET /api/v1/cohorts
 * Obtener todas las cohortes activas
 */
const getCohorts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { batchId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [cohorts, total] = await Promise.all([
      Cohort.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Cohort.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: cohorts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching cohorts:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_COHORTS_ERROR'
    });
  }
};

/**
 * GET /api/v1/cohorts/:batchId
 * Obtener una cohorte específica por batch-id
 */
const getCohortByBatchId = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const cohort = await Cohort.findByBatchId(batchId)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
    
    if (!cohort) {
      return res.status(404).json({
        success: false,
        error: 'Cohorte no encontrada',
        code: 'COHORT_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: cohort
    });
    
  } catch (error) {
    logger.error('Error fetching cohort:', {
      adminId: req.user?.userId,
      batchId: req.params.batchId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_COHORT_ERROR'
    });
  }
};

/**
 * POST /api/v1/cohorts
 * Crear una nueva cohorte
 */
const createCohort = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { batchId, name, description, featureFlags, referralConfig } = req.body;
    
    // Verificar que el batch-id no exista
    const existingCohort = await Cohort.findOne({ batchId: batchId.toLowerCase() });
    if (existingCohort) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una cohorte con este batch-id',
        code: 'COHORT_ALREADY_EXISTS'
      });
    }
    
    const cohort = new Cohort({
      batchId,
      name,
      description,
      featureFlags: {
        FEATURE_COHORT_PACKAGES: featureFlags?.FEATURE_COHORT_PACKAGES ?? true,
        FEATURE_COHORT_WITHDRAWALS: featureFlags?.FEATURE_COHORT_WITHDRAWALS ?? true
      },
      referralConfig: {
        directLevel1Percentage: referralConfig?.directLevel1Percentage ?? 10,
        specialParentCodePercentage: referralConfig?.specialParentCodePercentage ?? 10,
        specialParentCodeDelayDays: referralConfig?.specialParentCodeDelayDays ?? 17
      },
      createdBy: req.user._id
    });
    
    await cohort.save();
    
    logger.info('Cohort created:', {
      adminId: req.user.userId,
      cohortId: cohort._id,
      batchId: cohort.batchId,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      data: cohort,
      message: 'Cohorte creada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error creating cohort:', {
      adminId: req.user?.userId,
      cohortData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'CREATE_COHORT_ERROR'
    });
  }
};

/**
 * PUT /api/v1/cohorts/:batchId
 * Actualizar una cohorte existente
 */
const updateCohort = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { batchId } = req.params;
    const { name, description, featureFlags, referralConfig, isActive } = req.body;
    
    const cohort = await Cohort.findByBatchId(batchId);
    if (!cohort) {
      return res.status(404).json({
        success: false,
        error: 'Cohorte no encontrada',
        code: 'COHORT_NOT_FOUND'
      });
    }
    
    // Actualizar campos
    if (name !== undefined) cohort.name = name;
    if (description !== undefined) cohort.description = description;
    if (isActive !== undefined) cohort.isActive = isActive;
    
    if (featureFlags) {
      if (featureFlags.FEATURE_COHORT_PACKAGES !== undefined) {
        cohort.featureFlags.FEATURE_COHORT_PACKAGES = featureFlags.FEATURE_COHORT_PACKAGES;
      }
      if (featureFlags.FEATURE_COHORT_WITHDRAWALS !== undefined) {
        cohort.featureFlags.FEATURE_COHORT_WITHDRAWALS = featureFlags.FEATURE_COHORT_WITHDRAWALS;
      }
    }
    
    if (referralConfig) {
      if (referralConfig.directLevel1Percentage !== undefined) {
        cohort.referralConfig.directLevel1Percentage = referralConfig.directLevel1Percentage;
      }
      if (referralConfig.specialParentCodePercentage !== undefined) {
        cohort.referralConfig.specialParentCodePercentage = referralConfig.specialParentCodePercentage;
      }
      if (referralConfig.specialParentCodeDelayDays !== undefined) {
        cohort.referralConfig.specialParentCodeDelayDays = referralConfig.specialParentCodeDelayDays;
      }
    }
    
    cohort.updatedBy = req.user._id;
    await cohort.save();
    
    logger.info('Cohort updated:', {
      adminId: req.user.userId,
      cohortId: cohort._id,
      batchId: cohort.batchId,
      changes: req.body,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: cohort,
      message: 'Cohorte actualizada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error updating cohort:', {
      adminId: req.user?.userId,
      batchId: req.params.batchId,
      updateData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'UPDATE_COHORT_ERROR'
    });
  }
};

/**
 * POST /api/v1/cohorts/:batchId/flags
 * Actualizar feature flags específicos de una cohorte
 */
const updateCohortFlags = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { batchId } = req.params;
    const { featureFlags } = req.body;
    
    const cohort = await Cohort.findByBatchId(batchId);
    if (!cohort) {
      return res.status(404).json({
        success: false,
        error: 'Cohorte no encontrada',
        code: 'COHORT_NOT_FOUND'
      });
    }
    
    // Actualizar solo los feature flags proporcionados
    const updatedFlags = {};
    if (featureFlags.FEATURE_COHORT_PACKAGES !== undefined) {
      cohort.featureFlags.FEATURE_COHORT_PACKAGES = featureFlags.FEATURE_COHORT_PACKAGES;
      updatedFlags.FEATURE_COHORT_PACKAGES = featureFlags.FEATURE_COHORT_PACKAGES;
    }
    if (featureFlags.FEATURE_COHORT_WITHDRAWALS !== undefined) {
      cohort.featureFlags.FEATURE_COHORT_WITHDRAWALS = featureFlags.FEATURE_COHORT_WITHDRAWALS;
      updatedFlags.FEATURE_COHORT_WITHDRAWALS = featureFlags.FEATURE_COHORT_WITHDRAWALS;
    }
    
    cohort.updatedBy = req.user._id;
    await cohort.save();
    
    logger.info('Cohort flags updated:', {
      adminId: req.user.userId,
      cohortId: cohort._id,
      batchId: cohort.batchId,
      updatedFlags,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        batchId: cohort.batchId,
        featureFlags: cohort.featureFlags,
        updatedFlags
      },
      message: 'Feature flags actualizados exitosamente'
    });
    
  } catch (error) {
    logger.error('Error updating cohort flags:', {
      adminId: req.user?.userId,
      batchId: req.params.batchId,
      flagsData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'UPDATE_COHORT_FLAGS_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/cohorts/:batchId
 * Desactivar una cohorte (soft delete)
 */
const deleteCohort = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const cohort = await Cohort.findByBatchId(batchId);
    if (!cohort) {
      return res.status(404).json({
        success: false,
        error: 'Cohorte no encontrada',
        code: 'COHORT_NOT_FOUND'
      });
    }
    
    cohort.isActive = false;
    cohort.updatedBy = req.user._id;
    await cohort.save();
    
    logger.info('Cohort deactivated:', {
      adminId: req.user.userId,
      cohortId: cohort._id,
      batchId: cohort.batchId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Cohorte desactivada exitosamente'
    });
    
  } catch (error) {
    logger.error('Error deleting cohort:', {
      adminId: req.user?.userId,
      batchId: req.params.batchId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'DELETE_COHORT_ERROR'
    });
  }
};

module.exports = {
  getCohorts,
  getCohortByBatchId,
  createCohort,
  updateCohort,
  updateCohortFlags,
  deleteCohort
};