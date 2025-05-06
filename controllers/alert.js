// controllers/alerts.js
const { supabase } = require('../config/supabase');
const { detectAnomalies } = require('../services/azureML');

const getAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch vitals for anomaly detection
    const { data: vitalsData, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    // Use Azure ML to detect anomalies
    const anomalies = await detectAnomalies(vitalsData);

    // Fetch existing alerts
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (alertsError) throw new Error(alertsError.message);

    // Combine ML-detected anomalies with stored alerts
    const alerts = [
      ...anomalies.map((a) => ({
        id: `anomaly-${a.timestamp}`,
        message: `Anomaly detected in ${a.type}: ${a.value} ${a.unit}`,
        severity: a.severity || 'high',
        timestamp: a.timestamp,
      })),
      ...alertsData,
    ];

    res.json(alerts);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

module.exports = { getAlerts };