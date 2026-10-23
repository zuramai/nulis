import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

function model<T extends Schema>(name: string, schema: T): Model<InferSchemaType<T>> {
  return (mongoose.models[name] as Model<InferSchemaType<T>>) ?? mongoose.model(name, schema)
}

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

const githubConnectionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  githubId: { type: Number, required: true },
  login: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  tokenEnc: { type: String, required: true },
}, { timestamps: true })

const collectionSchema = new Schema({
  name: { type: String, required: true },
  baseDir: { type: String, default: '' },
  layout: { type: String, enum: ['flat', 'bundle'], required: true },
  glob: { type: String, required: true },
  bundleFile: String,
  imageDir: { type: String, required: true },
  extension: { type: String, default: 'md' },
}, { _id: false })

const projectSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  branch: { type: String, required: true },
  description: { type: String, default: '' },
  private: { type: Boolean, default: false },
  ssg: { type: String, default: 'generic' },
  collections: { type: [collectionSchema], default: [] },
  templates: { type: [new Schema({ name: String, path: String, body: String }, { _id: false })], default: [] },
  view: {
    columns: { type: [new Schema({ label: String, key: String, type: { type: String } }, { _id: false })], default: [] },
  },
  headSha: { type: String, default: null },
  /** Hash of the config files detection was based on; re-detect when it changes */
  detectionKey: { type: String, default: null },
  postCount: { type: Number, default: 0 },
  lastSyncedAt: { type: Date, default: null },
  lastUpdatedAt: { type: Date, default: null },
}, { timestamps: true })
projectSchema.index({ userId: 1, owner: 1, repo: 1 }, { unique: true })

const contentEntrySchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, required: true },
  collectionName: { type: String, required: true },
  path: { type: String, required: true },
  slug: { type: String, required: true },
  title: { type: String, default: '' },
  frontmatter: { type: Schema.Types.Mixed, default: {} },
  frontmatterKeys: { type: [String], default: [] },
  blobSha: { type: String, required: true },
  updatedAt: { type: Date, default: null },
}, { minimize: false })
contentEntrySchema.index({ projectId: 1, path: 1 }, { unique: true })

const pendingAssetSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, required: true, index: true },
  path: { type: String, required: true },
  mime: { type: String, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
})

export const User = model('User', userSchema)
export const GithubConnection = model('GithubConnection', githubConnectionSchema)
export const Project = model('Project', projectSchema)
export const ContentEntry = model('ContentEntry', contentEntrySchema)
export const PendingAsset = model('PendingAsset', pendingAssetSchema)

export type ProjectFields = InferSchemaType<typeof projectSchema> & { _id: unknown }
export type ContentEntryFields = InferSchemaType<typeof contentEntrySchema> & { _id: unknown }
export type ProjectDoc = InstanceType<typeof Project>
export type ContentEntryDoc = InstanceType<typeof ContentEntry>
