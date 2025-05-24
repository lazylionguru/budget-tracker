import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

// Simple test function
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to add a test document
    const testDoc = await addDoc(collection(db, 'test'), {
      message: 'Firebase connection successful!',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Firebase connected successfully! Test document ID:', testDoc.id);
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
};