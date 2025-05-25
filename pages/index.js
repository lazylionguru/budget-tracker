import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Users, BarChart3, Calendar, User, Home, TrendingUp, PieChart } from 'lucide-react';
import { 
  createHousehold as createHouseholdDB,
  getHouseholdByInviteCode,
  updateHousehold,
  getHouseholdById,
  addExpense as addExpenseDB,
  subscribeToExpenses,
  subscribeToHousehold
} from '../lib/firestore';
import { CURRENCIES, getCurrency, formatNumberWithCommas, parseNumberFromFormatted, isValidAmount, detectUserCurrency } from '../lib/currency';
import { formatCurrency } from '../lib/currency';

const BudgetTracker = () => {
  // State management
  const [currentView, setCurrentView] = useState('expenses');
  const [currentHousehold, setCurrentHousehold] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [userName, setUserName] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showJoinHousehold, setShowJoinHousehold] = useState(false);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [insightsPeriod, setInsightsPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);

  // Pre-defined categories with learning capability
  const defaultCategories = [
    'Groceries', 'Restaurants', 'Transportation', 'Utilities', 
    'Entertainment', 'Shopping', 'Healthcare', 'Cigarettes', 'Other'
  ];

  // Load data from localStorage on mount (for user preferences)
  useEffect(() => {
    const savedUserName = localStorage.getItem('userName') || '';
    const savedCurrentHouseholdId = localStorage.getItem('currentHousehold');
    
    setUserName(savedUserName);
    
    // Load household from Firebase if we have an ID
    if (savedCurrentHouseholdId) {
      loadHousehold(savedCurrentHouseholdId);
    }
  }, []);

  // Load household from Firebase
  const loadHousehold = async (householdId) => {
    try {
      setLoading(true);
      const household = await getHouseholdById(householdId);
      if (household) {
        setCurrentHousehold(household);
        
        // Set up real-time listeners
        const unsubscribeExpenses = subscribeToExpenses(householdId, (expensesList) => {
          setExpenses(expensesList);
        });
        
        const unsubscribeHousehold = subscribeToHousehold(householdId, (householdData) => {
          if (householdData) {
            setCurrentHousehold(householdData);
          }
        });
        
        // Store unsubscribe functions for cleanup
        return () => {
          unsubscribeExpenses();
          unsubscribeHousehold();
        };
      }
    } catch (error) {
      console.error('Error loading household:', error);
      alert('Error loading household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate 6-digit invite code
  const generateInviteCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Smart category suggestion based on description
  const suggestCategory = (description) => {
    // Build patterns from existing expenses
    const patterns = {};
    expenses.forEach(expense => {
      const words = expense.description.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 2) {
          if (!patterns[word]) patterns[word] = {};
          patterns[word][expense.category] = (patterns[word][expense.category] || 0) + 1;
        }
      });
    });

    // Find best match
    const words = description.toLowerCase().split(' ');
    const categoryScores = {};
    
    words.forEach(word => {
      if (patterns[word]) {
        Object.entries(patterns[word]).forEach(([category, count]) => {
          categoryScores[category] = (categoryScores[category] || 0) + count;
        });
      }
    });

    // Return most likely category or default suggestions
    if (Object.keys(categoryScores).length > 0) {
      const bestCategory = Object.entries(categoryScores).sort((a, b) => b[1] - a[1])[0][0];
      return bestCategory;
    }

    // Fallback to keyword matching
    const desc = description.toLowerCase();
    if (desc.includes('walmart') || desc.includes('grocery') || desc.includes('food')) return 'Groceries';
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('pizza')) return 'Restaurants';
    if (desc.includes('uber') || desc.includes('gas') || desc.includes('fuel')) return 'Transportation';
    if (desc.includes('electric') || desc.includes('water') || desc.includes('internet')) return 'Utilities';
    if (desc.includes('movie') || desc.includes('netflix') || desc.includes('game')) return 'Entertainment';
    if (desc.includes('cigarette') || desc.includes('smoke') || desc.includes('tobacco')) return 'Cigarettes';
    
    return 'Other';
  };

  // Create household (now using Firebase)
  const createHousehold = async (name) => {
    if (!userName.trim()) {
      alert('Please enter your name first');
      return;
    }

    try {
      setLoading(true);
      const householdData = {
        name: name.trim(),
        inviteCode: generateInviteCode(),
        members: [userName.trim()],
        createdBy: userName.trim(),
      };

      const newHousehold = await createHouseholdDB(householdData);
      setCurrentHousehold(newHousehold);
      
      // Save to localStorage for persistence
      localStorage.setItem('currentHousehold', newHousehold.id);
      localStorage.setItem('userName', userName.trim());
      
      setShowCreateHousehold(false);
      
      // Set up real-time listeners for the new household
      loadHousehold(newHousehold.id);
      
    } catch (error) {
      console.error('Error creating household:', error);
      alert('Error creating household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Join household (now using Firebase)
  const joinHousehold = async (inviteCode) => {
    if (!userName.trim()) {
      alert('Please enter your name first');
      return;
    }

    try {
      setLoading(true);
      const household = await getHouseholdByInviteCode(inviteCode.trim());
      
      if (!household) {
        alert('Invalid invite code');
        return;
      }

      // Add user to household if not already a member
      if (!household.members.includes(userName.trim())) {
        const updatedMembers = [...household.members, userName.trim()];
        await updateHousehold(household.id, { members: updatedMembers });
        household.members = updatedMembers;
      }

      setCurrentHousehold(household);
      localStorage.setItem('currentHousehold', household.id);
      localStorage.setItem('userName', userName.trim());
      setShowJoinHousehold(false);
      
      // Set up real-time listeners
      loadHousehold(household.id);
      
    } catch (error) {
      console.error('Error joining household:', error);
      alert('Error joining household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// Add expense (now using Firebase with currency)
const addExpense = async (amount, description, category, date, user, currency = 'USD') => {
  if (!currentHousehold) return;
  
  try {
    setLoading(true);
    const expenseData = {
      amount: parseFloat(amount),
      description: description.trim(),
      category,
      date,
      user,
      currency, // Add this line
      householdId: currentHousehold.id
    };

    await addExpenseDB(currentHousehold.id, expenseData);
    setShowAddExpense(false);
    
  } catch (error) {
    console.error('Error adding expense:', error);
    alert('Error adding expense. Please try again.');
  } finally {
    setLoading(false);
  }
};

  // Get expenses for current household (now from state, updated by real-time listener)
  const householdExpenses = useMemo(() => {
    return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses]);

  // Get daily/monthly aggregated data
  const getAggregatedData = (period = 'daily') => {
    if (!householdExpenses.length) return [];
    
    const grouped = {};
    householdExpenses.forEach(expense => {
      const date = new Date(expense.date);
      let key;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!grouped[key]) {
        grouped[key] = { date: key, total: 0, count: 0, expenses: [] };
      }
      grouped[key].total += expense.amount;
      grouped[key].count += 1;
      grouped[key].expenses.push(expense);
    });

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30); // Last 30 days/months
  };

  // Get insights data
  const getInsights = () => {
    if (!householdExpenses.length) return { byUser: [], byCategory: [], total: 0 };

    const now = new Date();
    const periodStart = new Date(now);
    
    if (insightsPeriod === 'weekly') {
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Make Monday = 1
      periodStart.setDate(now.getDate() - dayOfWeek + 1);
    } else {
      periodStart.setDate(1);
    }
    periodStart.setHours(0, 0, 0, 0);

    const periodExpenses = householdExpenses.filter(e => new Date(e.date) >= periodStart);
    
    const byUser = {};
    const byCategory = {};
    let total = 0;

    periodExpenses.forEach(expense => {
      // By user
      if (!byUser[expense.user]) byUser[expense.user] = 0;
      byUser[expense.user] += expense.amount;
      
      // By category
      if (!byCategory[expense.category]) byCategory[expense.category] = 0;
      byCategory[expense.category] += expense.amount;
      
      total += expense.amount;
    });

    return {
      byUser: Object.entries(byUser).map(([user, amount]) => ({ user, amount }))
        .sort((a, b) => b.amount - a.amount),
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      total,
      period: insightsPeriod
    };
  };

  // Components

// Clean SetupScreen Component using refs - eliminates all state sync issues

const SetupScreen = () => {
  const nameInputRef = useRef(null);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inputValue, setInputValue] = useState(userName); // Only for display
  const [isNameValid, setIsNameValid] = useState(userName.trim().length > 0);
  
  const handleNameChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);
    setIsNameValid(value.trim().length > 0);
    
    // Save to localStorage immediately
    if (value.trim()) {
      localStorage.setItem('userName', value.trim());
    }
  }, []);
  
  const getCurrentName = useCallback(() => {
    return nameInputRef.current?.value?.trim() || inputValue.trim();
  }, [inputValue]);
  
  const handleCreateHousehold = useCallback(() => {
    const currentName = getCurrentName();
    if (currentName) {
      // Update the global userName state with current input value
      setUserName(currentName);
      localStorage.setItem('userName', currentName);
      setShowCreateHousehold(true);
    }
  }, [getCurrentName]);
  
  const handleJoinHousehold = useCallback(() => {
    const currentName = getCurrentName();
    if (currentName) {
      // Update the global userName state with current input value
      setUserName(currentName);
      localStorage.setItem('userName', currentName);
      setShowJoinHousehold(true);
    }
  }, [getCurrentName]);

  // Handle create household submission
  const handleCreateSubmit = () => {
    if (householdName.trim() && !loading) {
      createHousehold(householdName);
      setHouseholdName('');
    }
  };

  // Handle join household submission
  const handleJoinSubmit = () => {
    if (inviteCode.trim().length === 6 && !loading) {
      joinHousehold(inviteCode);
      setInviteCode('');
    }
  };

  // Close modals and reset state
  const handleCloseCreate = () => {
    setShowCreateHousehold(false);
    setHouseholdName('');
  };

  const handleCloseJoin = () => {
    setShowJoinHousehold(false);
    setInviteCode('');
  };
  
  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Budget Tracker</h1>
        <p className="text-gray-600">Track expenses with your household</p>
      </div>

      <div className="space-y-4 mb-6">
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Enter your name"
          value={inputValue}
          onChange={handleNameChange}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoComplete="name"
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCreateHousehold}
          disabled={loading || !isNameValid}
          className="w-full bg-blue-500 text-white p-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Create New Household'}
        </button>
        
        <button
          onClick={handleJoinHousehold}
          disabled={loading || !isNameValid}
          className="w-full bg-gray-500 text-white p-3 rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Join Household'}
        </button>
      </div>

      {/* Create Household Modal */}
      {showCreateHousehold && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Create Household</h2>
            <input
              type="text"
              placeholder="Enter household name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSubmit();
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              autoComplete="off"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCloseCreate}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg disabled:opacity-50 hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={loading || !householdName.trim()}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Household Modal */}
      {showJoinHousehold && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Join Household</h2>
            <input
              type="text"
              placeholder="Enter 6-digit invite code"
              value={inviteCode}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                setInviteCode(value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJoinSubmit();
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-center text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              autoComplete="off"
              maxLength="6"
            />
            <div className="text-xs text-gray-500 text-center mb-4">
              {inviteCode.length}/6 digits
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCloseJoin}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg disabled:opacity-50 hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinSubmit}
                disabled={loading || inviteCode.length !== 6}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  // Enhanced ExpenseForm Component - replace the existing one in your pages/index.js
// Add this import at the top of your file:
// import { CURRENCIES, getCurrency, formatNumberWithCommas, parseNumberFromFormatted, isValidAmount, detectUserCurrency } from '../lib/currency';

const ExpenseForm = () => {
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState(() => {
    // Get currency from localStorage or detect user's currency
    return localStorage.getItem('preferredCurrency') || detectUserCurrency();
  });

  useEffect(() => {
    if (description) {
      const suggested = suggestCategory(description);
      setCategory(suggested);
    }
  }, [description]);

  // Save preferred currency
  useEffect(() => {
    localStorage.setItem('preferredCurrency', currency);
  }, [currency]);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    // Remove any non-digit, non-decimal characters except commas
    const cleanValue = value.replace(/[^\d.,]/g, '');
    
    // Parse the clean value
    const parsedValue = parseNumberFromFormatted(cleanValue);
    
    // Validate it's a proper number format
    if (parsedValue === '' || /^\d*\.?\d*$/.test(parsedValue)) {
      setAmount(parsedValue);
      setDisplayAmount(formatNumberWithCommas(parsedValue));
    }
  };

  const handleSubmit = () => {
    if (!amount || !description || !category || loading || !isValidAmount(amount)) return;
    
    // Pass the clean amount (without commas) to the database
    addExpense(parseFloat(amount), description, category, date, userName, currency);
    
    // Reset form
    setAmount('');
    setDisplayAmount('');
    setDescription('');
    setCategory('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const selectedCurrency = getCurrency(currency);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Add Expense</h2>
        <div className="space-y-4">
          {/* Currency Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.symbol} {curr.name} ({curr.code})
                </option>
              ))}
            </select>
          </div>
          
          {/* Amount Input with Currency Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-lg">
                  {selectedCurrency.symbol}
                </span>
              </div>
              <input
                type="text"
                placeholder="0.00"
                value={displayAmount}
                onChange={handleAmountChange}
                className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                required
                inputMode="decimal"
                autoComplete="off"
              />
            </div>
            {displayAmount && (
              <div className="mt-1 text-sm text-gray-600">
                {selectedCurrency.symbol}{formatNumberWithCommas(amount)}
              </div>
            )}
          </div>
          
          <input
            type="text"
            placeholder="What was it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            autoComplete="off"
          />
          
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select category</option>
            {defaultCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddExpense(false)}
              disabled={loading}
              className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !isValidAmount(amount)}
              className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Updated ExpensesView and InsightsView components - replace in your pages/index.js
// Make sure to import: import { formatCurrency } from '../lib/currency';

const ExpensesView = () => {
  const dailyData = getAggregatedData('daily');
  const monthlyData = getAggregatedData('monthly');
  const [viewMode, setViewMode] = useState('daily');
  
  const data = viewMode === 'daily' ? dailyData : monthlyData;
  const maxAmount = Math.max(...data.map(d => d.total), 1);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (viewMode === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  // Get the primary currency used in household
  const getPrimaryCurrency = () => {
    if (!householdExpenses.length) return 'USD';
    
    // Count currency usage
    const currencyCount = {};
    householdExpenses.forEach(expense => {
      const curr = expense.currency || 'USD';
      currencyCount[curr] = (currencyCount[curr] || 0) + 1;
    });
    
    // Return most used currency
    return Object.entries(currencyCount)
      .sort((a, b) => b[1] - a[1])[0][0];
  };

  const primaryCurrency = getPrimaryCurrency();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {currentHousehold?.name}
        </h2>
        <div className="text-sm text-gray-600">
          Code: {currentHousehold?.inviteCode}
        </div>
      </div>

      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setViewMode('daily')}
          className={`px-3 py-1 rounded-full text-sm ${
            viewMode === 'daily' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setViewMode('monthly')}
          className={`px-3 py-1 rounded-full text-sm ${
            viewMode === 'monthly' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Monthly
        </button>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-end space-x-1 h-32 overflow-x-auto">
          {data.map((item, index) => {
            const height = (item.total / maxAmount) * 100;
            return (
              <div
                key={item.date}
                className="flex flex-col items-center min-w-0 flex-1"
                onClick={() => setSelectedDate(selectedDate === item.date ? null : item.date)}
              >
                <div
                  className={`w-full bg-blue-500 hover:bg-blue-600 cursor-pointer rounded-t transition-colors ${
                    selectedDate === item.date ? 'bg-blue-700' : ''
                  }`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <div className="text-xs mt-1 text-center text-gray-600 transform -rotate-45 origin-center">
                  {formatDate(item.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h3 className="font-bold mb-2">
            {viewMode === 'daily' ? 'Day' : 'Month'} Details - {formatDate(selectedDate)}
          </h3>
          {data
            .find(d => d.date === selectedDate)
            ?.expenses.map(expense => (
              <div key={expense.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                <div>
                  <div className="font-medium">{expense.description}</div>
                  <div className="text-sm text-gray-600">{expense.category} • {expense.user}</div>
                </div>
                <div className="font-bold">
                  {formatCurrency(expense.amount, expense.currency || 'USD')}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold mb-2">Recent Expenses</h3>
        {householdExpenses.slice(0, 10).map(expense => (
          <div key={expense.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
            <div>
              <div className="font-medium">{expense.description}</div>
              <div className="text-sm text-gray-600">
                {expense.category} • {expense.user} • {new Date(expense.date).toLocaleDateString()}
              </div>
            </div>
            <div className="font-bold">
              {formatCurrency(expense.amount, expense.currency || 'USD')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InsightsView = () => {
  const insights = getInsights();

  // Group insights by currency
  const getInsightsByCurrency = () => {
    if (!householdExpenses.length) return {};

    const now = new Date();
    const periodStart = new Date(now);
    
    if (insightsPeriod === 'weekly') {
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      periodStart.setDate(now.getDate() - dayOfWeek + 1);
    } else {
      periodStart.setDate(1);
    }
    periodStart.setHours(0, 0, 0, 0);

    const periodExpenses = householdExpenses.filter(e => new Date(e.date) >= periodStart);
    
    // Group by currency
    const byCurrency = {};
    periodExpenses.forEach(expense => {
      const currency = expense.currency || 'USD';
      if (!byCurrency[currency]) {
        byCurrency[currency] = {
          total: 0,
          byUser: {},
          byCategory: {},
          expenses: []
        };
      }
      
      byCurrency[currency].total += expense.amount;
      byCurrency[currency].expenses.push(expense);
      
      // By user
      if (!byCurrency[currency].byUser[expense.user]) {
        byCurrency[currency].byUser[expense.user] = 0;
      }
      byCurrency[currency].byUser[expense.user] += expense.amount;
      
      // By category
      if (!byCurrency[currency].byCategory[expense.category]) {
        byCurrency[currency].byCategory[expense.category] = 0;
      }
      byCurrency[currency].byCategory[expense.category] += expense.amount;
    });

    // Convert to arrays
    Object.keys(byCurrency).forEach(currency => {
      byCurrency[currency].byUser = Object.entries(byCurrency[currency].byUser)
        .map(([user, amount]) => ({ user, amount }))
        .sort((a, b) => b.amount - a.amount);
      
      byCurrency[currency].byCategory = Object.entries(byCurrency[currency].byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    });

    return byCurrency;
  };

  const insightsByCurrency = getInsightsByCurrency();
  const currencies = Object.keys(insightsByCurrency).sort();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Insights</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setInsightsPeriod('weekly')}
            className={`px-3 py-1 rounded-full text-sm ${
              insightsPeriod === 'weekly' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setInsightsPeriod('monthly')}
            className={`px-3 py-1 rounded-full text-sm ${
              insightsPeriod === 'monthly' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {currencies.length === 0 ? (
        <div className="bg-white rounded-lg p-4 shadow-sm text-center text-gray-500">
          No expenses in this period
        </div>
      ) : (
        currencies.map(currency => {
          const currencyData = insightsByCurrency[currency];
          
          return (
            <div key={currency} className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-gray-700">
                {currency} Expenses
              </h3>
              
              {/* Total for this currency */}
              <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                <h4 className="font-bold mb-2">
                  Total {insightsPeriod === 'weekly' ? 'This Week' : 'This Month'}
                </h4>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(currencyData.total, currency)}
                </div>
              </div>

              {/* By User */}
              <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                <h4 className="font-bold mb-3">Expenses by User</h4>
                {currencyData.byUser.map(item => (
                  <div key={item.user} className="flex justify-between items-center py-2">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      <span>{item.user}</span>
                    </div>
                    <div className="font-bold">
                      {formatCurrency(item.amount, currency)}
                    </div>
                  </div>
                ))}
              </div>

              {/* By Category */}
              <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                <h4 className="font-bold mb-3">Expenses by Category</h4>
                {currencyData.byCategory.map(item => {
                  const percentage = currencyData.total > 0 ? (item.amount / currencyData.total) * 100 : 0;
                  return (
                    <div key={item.category} className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span>{item.category}</span>
                        <span className="font-bold">
                          {formatCurrency(item.amount, currency)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

  // Show loading screen while initializing
  if (loading && !currentHousehold) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
          <div className="text-gray-600">Setting up your household</div>
        </div>
      </div>
    );
  }

  // Main render
  if (!currentHousehold) {
    return <SetupScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">{currentHousehold.name}</h1>
          <div className="text-sm text-gray-600">
            {currentHousehold.members?.length || 0} member{(currentHousehold.members?.length || 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => setShowAddExpense(true)}
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="pb-16">
        {currentView === 'expenses' && <ExpensesView />}
        {currentView === 'insights' && <InsightsView />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button
            onClick={() => setCurrentView('expenses')}
            className={`flex-1 p-4 flex flex-col items-center space-y-1 ${
              currentView === 'expenses' ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs">Expenses</span>
          </button>
          <button
            onClick={() => setCurrentView('insights')}
            className={`flex-1 p-4 flex flex-col items-center space-y-1 ${
              currentView === 'insights' ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-xs">Insights</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddExpense && <ExpenseForm />}
    </div>
  );
};

export default BudgetTracker;