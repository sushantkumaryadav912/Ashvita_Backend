// Schema definition for the admins table in Supabase
const adminSchema = {
    tableName: 'admins',
    columns: {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: 'uuid_generate_v4()',
        description: 'Unique identifier for the admin',
      },
      user_id: {
        type: 'uuid',
        references: 'users(id)',
        onDelete: 'CASCADE',
        description: 'Foreign key referencing the users table',
      },
      role: {
        type: 'text',
        description: 'Admin role (e.g., Super Admin, Moderator)',
      },
      permissions: {
        type: 'jsonb',
        description: 'Admin permissions (e.g., ["manage_users", "view_reports"])',
      },
      created_at: {
        type: 'timestamp with time zone',
        default: 'now()',
        description: 'Timestamp when the admin record was created',
      },
    },
    description: 'Table storing admin profiles linked to users',
  };
  
  module.exports = adminSchema;