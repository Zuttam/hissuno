/**
 * Seed script - creates admin user and optionally a demo project.
 *
 * Usage:
 *   npm run seed -- --env-file .env.local
 *   npm run seed -- --env-file .env.local --demo
 *
 * Flags:
 *   --env-file <path>      Load environment variables from a file (required for DATABASE_URL)
 *   --demo                 Also create a demo project with sample data
 *   --output-api-key       Print a generated API key to stdout (for CLI auto-config)
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars.
 * If SEED_ADMIN_PASSWORD is not set, a random password is generated and printed.
 */

import dotenv from 'dotenv'

// Load env file before any other imports that depend on DATABASE_URL
const envFileIndex = process.argv.indexOf('--env-file')
if (envFileIndex !== -1 && process.argv[envFileIndex + 1]) {
  dotenv.config({ path: process.argv[envFileIndex + 1] })
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Pass --env-file <path> to load it.')
    process.exit(1)
  }

  // Dynamic imports so DATABASE_URL is available when db module loads
  const { eq } = await import('drizzle-orm')
  const bcrypt = await import('bcryptjs')
  const { db } = await import('@/lib/db')
  const { users } = await import('@/lib/db/schema/auth')
  const { userProfiles } = await import('@/lib/db/schema/app')

  const crypto = await import('node:crypto')
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@hissuno.com'
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(16).toString('base64url')
  const ADMIN_NAME = 'Admin User'
  const BCRYPT_ROUNDS = 10

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`[seed] Generated admin password: ${ADMIN_PASSWORD}`)
    console.log('[seed] Set SEED_ADMIN_PASSWORD env var to use a fixed password.')
  }

  try {
    console.log('[seed] Starting...')

    // -- 1. Admin user (upsert by email) ------------------------------------
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS)

    const [adminUser] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password_hash: passwordHash,
        emailVerified: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: ADMIN_NAME,
          password_hash: passwordHash,
          emailVerified: new Date(),
          updated_at: new Date(),
        },
      })
      .returning({ id: users.id })

    console.log(`[seed] Upserted admin user: ${ADMIN_EMAIL}`)

    // -- 2. User profile ----------------------------------------------------
    const [existingProfile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.user_id, adminUser!.id))
      .limit(1)

    if (existingProfile) {
      await db
        .update(userProfiles)
        .set({
          full_name: ADMIN_NAME,
          company_name: 'Hissuno',
          role: 'admin',
          company_size: '1-10',
        })
        .where(eq(userProfiles.user_id, adminUser!.id))
    } else {
      await db.insert(userProfiles).values({
        user_id: adminUser!.id,
        full_name: ADMIN_NAME,
        company_name: 'Hissuno',
        role: 'admin',
        company_size: '1-10',
      })
    }

    console.log('[seed] Upserted admin user profile')

    // -- 3. Demo project (opt-in via --demo flag) -----------------------------
    if (process.argv.includes('--demo')) {
      const { createProjectWithDemoData } = await import('@/lib/demo/create-project')

      console.log('[seed] Creating demo project with sample data...')
      const { project, demoStats } = await createProjectWithDemoData({
        projectName: 'Demo Project',
        projectDescription: 'A pre-built project with sample data to help you explore Hissuno.',
        userId: adminUser!.id,
      })
      console.log(`[seed] Created demo project: ${project.name} (${project.id})`)
      console.log('[seed] Demo data:', demoStats)
    }

    // -- 4. Generate API key (opt-in via --output-api-key flag) ----------------
    if (process.argv.includes('--output-api-key') && process.argv.includes('--demo')) {
      const crypto = await import('node:crypto')
      const { projectApiKeys, projects } = await import('@/lib/db/schema/app')

      // Find the demo project
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .limit(1)

      if (project) {
        const rawKey = `hiss_${crypto.randomBytes(24).toString('base64url')}`
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
        const prefix = rawKey.slice(0, 12)

        await db.insert(projectApiKeys).values({
          project_id: project.id,
          created_by_user_id: adminUser!.id,
          name: 'Setup CLI Key',
          key_hash: keyHash,
          key_prefix: prefix,
        })

        // Print to stdout for the CLI to capture
        console.log(`HISSUNO_API_KEY=${rawKey}`)
      }
    }

    console.log('[seed] Done!')
  } catch (error) {
    console.error('[seed] Error:', error)
    process.exit(1)
  }
}

seed()
