const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.register = async (req, res) => {
  const { email, password, userType, name, phone, emergencyContact } = req.body;

  try {
    // Validate required fields
    if (!email || !password || !userType || !name || !phone) {
      return res.status(400).json({ error: 'Email, password, user type, name, and phone are required' });
    }
    if (userType === 'patient' && !emergencyContact) {
      return res.status(400).json({ error: 'Emergency contact is required for patients' });
    }

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into users table
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ email, password: hashedPassword, userType, name, phone }])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Insert into appropriate profile table
    let profileTable;
    let profileData = { userId: newUser.id, name };
    switch (userType) {
      case 'patient':
        profileTable = 'patients';
        profileData.emergencyContact = emergencyContact;
        break;
      case 'doctor':
        profileTable = 'doctors';
        break;
      case 'admin':
        profileTable = 'admins';
        break;
      default:
        return res.status(400).json({ error: 'Invalid user type' });
    }

    const { error: profileError } = await supabase
      .from(profileTable)
      .insert([profileData]);

    if (profileError) {
      throw profileError;
    }

    // Generate JWT token
    const token = jwt.sign({ id: newUser.id, userType }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(201).json({ token, user: { id: newUser.id, email, userType, name, phone } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, userType: user.userType, name: user.name, phone: user.phone },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('email', email);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};