# 🗃️ Base de Datos — MongoDB Atlas (Única)

## Reglas
- Conexión **Atlas obligatoria**. Si `DB_KIND !== 'atlas'` → **salir**.
- Índices de **idempotencia** en `transactions` y `purchases` por `txHash` (y red).
- **Una sola origin** en prod.

## Esquemas (Mongoose)

### User
```js
{
  email: { type:String, unique:true, index:true },
  passHash: String,
  name: String,
  referralCode: { type:String, unique:true, index:true },
  referredBy: { type:ObjectId, ref:'User' },
  role: { type:String, enum:['user','admin'], default:'user' },
  telegram: { chatId:String, username:String, pinEnabled:Boolean },
  balances: { available:{type:Number,default:0}, pending:{type:Number,default:0}, locked:{type:Number,default:0} },
}, { timestamps:true }
```

### Package
```js
{ name:String, price:Number, isActive:Boolean, dailyRate:Number, totalCycles:Number, activeDaysPerCycle:Number, pauseDayPerCycle:Number }
```

### Wallet
```js
{ address:{type:String,unique:true}, network:{type:String,enum:['BEP20']}, status:{type:String,enum:['active','inactive']}, usageCount:Number, lastUsed:Date }
```

### Purchase
```js
{
  user:{type:ObjectId, ref:'User', index:true},
  package:{type:ObjectId, ref:'Package'},
  amount:Number,
  assignedWallet:{type:ObjectId, ref:'Wallet'},
  txHash:{type:String, index:true, unique:true, sparse:true},
  network:{type:String, default:'BEP20'},
  status:{type:String, enum:['pending','confirmed','cancelled','expired'], index:true},
  expiresAt:Date, confirmedAt:Date
}
```

### Transaction
```js
{
  user:{type:ObjectId, ref:'User', index:true},
  type:{type:String, enum:['package_purchase','withdrawal']},
  amount:Number, currency:{type:String, default:'USDT'},
  payment:{ method:String, address:String, network:String, confirmations:Number },
  status:{type:String, enum:['pending','confirmed','expired','failed'], index:true},
  externalReference:{type:String, unique:true, sparse:true},
  expiresAt:Date
}
```

### BenefitPlan
```js
{ user:ObjectId, purchase:ObjectId, package:ObjectId, dailyRate:Number, totalCycles:Number, activeDaysPerCycle:Number, pauseDayPerCycle:Number, startedAt:Date, status:{type:String, enum:['active','completed','paused','cancelled']} }
```

### BenefitLedger
```js
{ user:ObjectId, purchase:ObjectId, plan:ObjectId, dayIndex:Number, cycleIndex:Number, amount:Number, status:{type:String, enum:['pending','available','reverted']}, availableAt:Date }
```

### Commission
```js
{ userId:ObjectId, fromUserId:ObjectId, purchase:ObjectId, commissionType:{type:String, enum:['direct_referral','parent_bonus','leader_bonus']}, amount:Number, status:{type:String, enum:['pending','available','paid','cancelled']}, unlockedAt:Date, paidAt:Date, metadata:Object }
```

### SpecialCode (Padre/Líder)
```js
{ type:{type:String, enum:['PARENT','LEADER']}, code:{type:String, unique:true}, owner:{type:ObjectId, ref:'User'}, status:{type:String, enum:['active','inactive']} }
```

### Withdrawal
```js
{ user:ObjectId, amount:Number, address:String, network:{type:String,default:'BEP20'}, status:{type:String, enum:['requested','approved','exported','completed','rejected']}, pinVerifiedAt:Date, exportBatchId:String, adminNotes:String }
```

## Índices Clave
- `Purchase.txHash` unique (sparse).
- `Transaction.externalReference` unique.
- `Purchase.status`, `Transaction.status`, `Withdrawal.status` indexados.
