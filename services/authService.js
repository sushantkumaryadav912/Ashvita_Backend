import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.API_BASE_URL; // Ensure this matches your backend server URL

export const signUp = async (email, password, userType) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password,
      userType,
      name: email.split('@')[0], // Use email prefix as name for simplicity
    });

    const { token, user } = response.data;
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('userType', user.userType);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to create account');
  }
};

export const signIn = async (email, password) => {
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
};

export const signOut = async () => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('userType');
};