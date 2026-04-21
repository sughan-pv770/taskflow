require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('./db');

const seed = async () => {
  console.log('Seeding database...');

  // Create two demo organizations
  const org1Id = uuidv4();
  const org2Id = uuidv4();

  await query(`
    INSERT INTO organizations (id, name, slug) VALUES
    ($1, 'Acme Corp', 'acme-corp'),
    ($2, 'Globex Inc', 'globex-inc')
    ON CONFLICT (slug) DO NOTHING;
  `, [org1Id, org2Id]);

  // Fetch actual org IDs in case they already existed
  const { rows: orgs } = await query(`SELECT id, slug FROM organizations WHERE slug IN ('acme-corp', 'globex-inc')`);
  const acme = orgs.find(o => o.slug === 'acme-corp');
  const globex = orgs.find(o => o.slug === 'globex-inc');

  const hash = await bcrypt.hash('Password123!', 12);

  // Acme users
  const admin1Id = uuidv4();
  const member1Id = uuidv4();
  await query(`
    INSERT INTO users (id, organization_id, name, email, password_hash, role) VALUES
    ($1, $2, 'Alice Admin', 'alice@acme.com', $3, 'admin'),
    ($4, $2, 'Bob Member', 'bob@acme.com', $3, 'member')
    ON CONFLICT (email, organization_id) DO NOTHING;
  `, [admin1Id, acme.id, hash, member1Id]);

  // Globex users
  const admin2Id = uuidv4();
  await query(`
    INSERT INTO users (id, organization_id, name, email, password_hash, role) VALUES
    ($1, $2, 'Carol Admin', 'carol@globex.com', $3, 'admin')
    ON CONFLICT (email, organization_id) DO NOTHING;
  `, [admin2Id, globex.id, hash]);

  // Fetch real user IDs
  const { rows: users } = await query(`SELECT id, email FROM users WHERE email IN ('alice@acme.com', 'bob@acme.com', 'carol@globex.com')`);
  const alice = users.find(u => u.email === 'alice@acme.com');
  const bob = users.find(u => u.email === 'bob@acme.com');

  // Seed tasks for Acme
  const taskStatuses = ['todo', 'in_progress', 'in_review', 'done'];
  const taskPriorities = ['low', 'medium', 'high', 'critical'];
  const sampleTasks = [
    { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment', status: 'done', priority: 'high' },
    { title: 'Design database schema', description: 'Create ERD and finalize relationships for all entities', status: 'done', priority: 'critical' },
    { title: 'Build authentication module', description: 'Implement JWT-based auth with refresh token support', status: 'in_progress', priority: 'critical' },
    { title: 'Create task CRUD endpoints', description: 'RESTful API endpoints for task management', status: 'in_progress', priority: 'high' },
    { title: 'Write unit tests', description: 'Cover all service functions with Jest unit tests', status: 'todo', priority: 'medium' },
    { title: 'Implement RBAC middleware', description: 'Role-based access control for all protected routes', status: 'in_review', priority: 'high' },
    { title: 'Set up Docker Compose', description: 'Containerize all services with proper networking', status: 'done', priority: 'medium' },
    { title: 'Add audit logging', description: 'Track all create, update, delete operations with metadata', status: 'todo', priority: 'medium' },
  ];

  for (const task of sampleTasks) {
    const taskId = uuidv4();
    const assignee = Math.random() > 0.5 ? alice.id : bob.id;
    await query(`
      INSERT INTO tasks (id, organization_id, title, description, status, priority, creator_id, assignee_id, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING;
    `, [taskId, acme.id, task.title, task.description, task.status, task.priority, alice.id, assignee,
        new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000)]);
  }

  console.log('✅ Seed complete.');
  console.log('');
  console.log('Demo accounts (password: Password123!):');
  console.log('  alice@acme.com  — Admin @ Acme Corp');
  console.log('  bob@acme.com    — Member @ Acme Corp');
  console.log('  carol@globex.com — Admin @ Globex Inc');
  process.exit(0);
};

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
