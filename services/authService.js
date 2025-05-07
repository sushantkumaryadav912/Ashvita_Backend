const { supabase } = require('../config/supabase');

const authService = {
  signUp: async (email, password, userType, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { userType, name }
        }
      });

      if (error) throw new Error(error.message);

      const user = data.user;
      const token = data.session?.access_token;

      if (!user || !token) {
        throw new Error('Failed to create account');
      }

      if (userType === 'patient' || userType === 'doctor' || userType === 'admin') {
        const { error: profileError } = await supabase
          .from(userType === 'patient' ? 'patients' : userType === 'doctor' ? 'doctors' : 'admins')
          .insert({
            id: user.id,
            email,
            name,
            userType,
          });

        if (profileError) throw new Error(profileError.message);
      }

      return { token, user: { id: user.id, email, userType, name } };
    } catch (error) {
      throw new Error(error.message || 'Failed to create account');
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      const user = data.user;
      const token = data.session?.access_token;

      if (!user || !token) {
        throw new Error('Invalid credentials');
      }

      const { data: profile, error: profileError } = await supabase
        .from(user.user_metadata.userType === 'patient' ? 'patients' : user.user_metadata.userType === 'doctor' ? 'doctors' : 'admins')
        .select('userType, name')
        .eq('id', user.id)
        .single();

      if (profileError) throw new Error(profileError.message);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          userType: profile.userType || user.user_metadata.userType,
          name: profile.name || user.user_metadata.name,
        },
      };
    } catch (error) {
      throw new Error(error.message || 'Invalid credentials');
    }
  },

  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.API_BASE_URL}/reset-password`,
      });

      if (error) throw new Error(error.message);

      return { message: 'Password reset email sent' };
    } catch (error) {
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  signOut: async (token) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
      return { message: 'Signed out successfully' };
    } catch (error) {
      throw new Error(error.message || 'Failed to sign out');
    }
  },

  verifyToken: async (token) => {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) throw new Error(error.message);
      return data.user;
    } catch (error) {
      throw new Error(error.message || 'Invalid token');
    }
  },
};

module.exports = authService;