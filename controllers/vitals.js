// controllers/vitals.js
const { supabase } = require('../config/supabase');
const { getIoTData } = require('../services/azureIoT');

const getVitals = async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch vitals from Supabase
    const { data: vitalsData, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    // Fetch real-time IoT data from Azure IoT Hub
    const iotVitals = await getIoTData(userId);

    // Combine Supabase and IoT data
    const vitals = [
      ...vitalsData,
      ...iotVitals.map((v) => ({
        title: v.type,
        value: v.value,
        unit: v.unit,
        icon: v.type.toLowerCase(),
        color: getVitalColor(v.type),
        trend: v.trend || 'stable',
        timestamp: v.timestamp,
      })),
    ];

    res.json(vitals);
  } catch (err) {
    console.error('Error fetching vitals:', err);
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
};

const getVitalColor = (type) => {
  const colors = {
    heartrate: '#ff4d4d',
    bloodpressure: '#007bff',
    oxygen: '#28a745',
  };
  return colors[type.toLowerCase()] || '#666';
};

module.exports = { getVitals };