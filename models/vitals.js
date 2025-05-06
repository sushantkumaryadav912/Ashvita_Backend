// Schema definition for the vitals table in Supabase
const vitalsSchema = {
    tableName: 'vitals',
    columns: {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: 'uuid_generate_v4()',
        description: 'Unique identifier for the vital record',
      },
      patient_id: {
        type: 'uuid',
        references: 'patients(id)',
        onDelete: 'CASCADE',
        description: 'Foreign key referencing the patients table',
      },
      title: {
        type: 'text',
        description: 'Type of vital (e.g., heart_rate, blood_pressure, temperature, oxygen_level)',
      },
      value: {
        type: 'numeric',
        description: 'Value of the vital sign',
      },
      unit: {
        type: 'text',
        description: 'Unit of measurement (e.g., bpm, mmHg, °C, %)',
      },
      icon: {
        type: 'text',
        description: 'Icon name for UI display (e.g., heart, thermometer)',
      },
      color: {
        type: 'text',
        description: 'Color for UI display (e.g., #FF0000 for red)',
      },
      trend: {
        type: 'text',
        description: 'Trend of the vital (e.g., stable, increasing, decreasing)',
      },
      timestamp: {
        type: 'timestamp with time zone',
        default: 'now()',
        description: 'Timestamp when the vital was recorded',
      },
    },
    description: 'Table storing patient vital signs with metadata for UI display',
  };
  
  module.exports = vitalsSchema;