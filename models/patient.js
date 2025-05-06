// Schema definition for the patients table in Supabase
const patientSchema = {
    tableName: 'patients',
    columns: {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: 'uuid_generate_v4()',
        description: 'Unique identifier for the patient',
      },
      user_id: {
        type: 'uuid',
        references: 'users(id)',
        onDelete: 'CASCADE',
        description: 'Foreign key referencing the users table',
      },
      medical_history: {
        type: 'jsonb',
        default: '[]',
        description: 'Array of medical history entries (conditions, surgeries, etc.)',
      },
      allergies: {
        type: 'jsonb',
        default: '[]',
        description: 'Array of allergies (e.g., medications, foods)',
      },
      emergency_contacts: {
        type: 'jsonb',
        default: '[]',
        description: 'Array of emergency contacts with name, phone, and relation',
      },
      created_at: {
        type: 'timestamp with time zone',
        default: 'now()',
        description: 'Timestamp when the patient record was created',
      },
    },
    description: 'Table storing patient profiles linked to users, including medical history and emergency contacts',
  };
  
  module.exports = patientSchema;