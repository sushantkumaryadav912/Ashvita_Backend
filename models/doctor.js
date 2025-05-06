// Schema definition for the doctors table in Supabase
const doctorSchema = {
    tableName: 'doctors',
    columns: {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: 'uuid_generate_v4()',
        description: 'Unique identifier for the doctor',
      },
      user_id: {
        type: 'uuid',
        references: 'users(id)',
        onDelete: 'CASCADE',
        description: 'Foreign key referencing the users table',
      },
      created_at: {
        type: 'timestamp with time zone',
        default: 'now()',
        description: 'Timestamp when the doctor record was created',
      },
    },
    description: 'Table storing doctor profiles linked to users',
  };
  
  module.exports = doctorSchema;