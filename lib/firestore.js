import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc,
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

// Household operations
export const createHousehold = async (householdData) => {
  try {
    const docRef = await addDoc(collection(db, 'households'), {
      ...householdData,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...householdData };
  } catch (error) {
    console.error('Error creating household:', error);
    throw error;
  }
};

export const getHouseholdByInviteCode = async (inviteCode) => {
  try {
    const q = query(
      collection(db, 'households'), 
      where('inviteCode', '==', inviteCode)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error finding household:', error);
    throw error;
  }
};

export const updateHousehold = async (householdId, data) => {
  try {
    const householdRef = doc(db, 'households', householdId);
    await updateDoc(householdRef, data);
  } catch (error) {
    console.error('Error updating household:', error);
    throw error;
  }
};

export const getHouseholdById = async (householdId) => {
  try {
    const householdRef = doc(db, 'households', householdId);
    const householdSnap = await getDoc(householdRef);
    
    if (householdSnap.exists()) {
      return { id: householdSnap.id, ...householdSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting household:', error);
    throw error;
  }
};

// Expense operations with currency support
export const addExpense = async (householdId, expenseData) => {
  try {
    const docRef = await addDoc(collection(db, 'households', householdId, 'expenses'), {
      ...expenseData,
      // Ensure currency is included
      currency: expenseData.currency || 'USD',
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...expenseData };
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
};

export const getExpenses = async (householdId) => {
  try {
    const q = query(
      collection(db, 'households', householdId, 'expenses'),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const expenses = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    
    return expenses;
  } catch (error) {
    console.error('Error getting expenses:', error);
    throw error;
  }
};

// Real-time listeners
export const subscribeToExpenses = (householdId, callback) => {
  const q = query(
    collection(db, 'households', householdId, 'expenses'),
    orderBy('date', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const expenses = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    callback(expenses);
  });
};

export const subscribeToHousehold = (householdId, callback) => {
  const householdRef = doc(db, 'households', householdId);
  
  return onSnapshot(householdRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    } else {
      callback(null);
    }
  });
};