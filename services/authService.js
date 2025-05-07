import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.API_BASE_URL || 'api.example.com';

const authService = {
  signUp: async (email, password, userType, name) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        userType,
        name,
      });

      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('userType', user.userType);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create account');
    }
  },

  signIn: async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('userType', user.userType);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Invalid credentials');
    }
  },

  resetPassword: async (email, currentPassword, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        email,
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to reset password');
    }
  },

  signOut: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('userType');
  },
};

export default authService;