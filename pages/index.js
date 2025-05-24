import React, { useState, useEffect, useMemo } from 'react';
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
import { testFirebaseConnection } from '../lib/test-firebase';

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

  // Add expense (now using Firebase)
  const addExpense = async (amount, description, category, date, user) => {
    if (!currentHousehold) return;
    
    try {
      setLoading(true);
      const expenseData = {
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        date,
        user,
        householdId: currentHousehold.id
      };

      await addExpenseDB(currentHousehold.id, expenseData);
      setShowAddExpense(false);
      
      // The real-time listener will automatically update the expenses list
      
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Error adding expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Test Firebase connection
  const handleTestFirebase = async () => {
    try {
      const isConnected = await testFirebaseConnection();
      if (isConnected) {
        alert('✅ Firebase connected successfully!');
      } else {
        alert('❌ Firebase connection failed. Check console for details.');
      }
    } catch (error) {
      console.error('Test error:', error);
      alert('❌ Error testing Firebase connection: ' + error.message);
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
  const SetupScreen = () => {
    const [localName, setLocalName] = useState(userName);
    
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Budget Tracker</h1>
          <p className="text-gray-600">Track expenses with your household</p>
        </div>

        <div className="space-y-4 mb-6">
          <input
            type="text"
            placeholder="Enter your name"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              setUserName(e.target.value);
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setShowCreateHousehold(true)}
            disabled={loading}
            className="w-full bg-blue-500 text-white p-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Create New Household'}
          </button>
          
          <button
            onClick={() => setShowJoinHousehold(true)}
            disabled={loading}
            className="w-full bg-gray-500 text-white p-3 rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Join Household'}
          </button>
          
          <button
            onClick={handleTestFirebase}
            className="w-full bg-green-500 text-white p-3 rounded-lg font-medium hover:bg-green-600 transition-colors"
          >
            Test Firebase Connection
          </button>
        </div>

        {showCreateHousehold && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Create Household</h2>
              <input
                type="text"
                placeholder="Enter household name"
                className="w-full p-3 border border-gray-300 rounded-lg mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim() && !loading) {
                    createHousehold(e.target.value);
                  }
                }}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCreateHousehold(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.parentElement.querySelector('input');
                    if (input.value.trim() && !loading) {
                      createHousehold(input.value);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showJoinHousehold && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Join Household</h2>
              <input
                type="text"
                placeholder="Enter 6-digit invite code"
                maxLength="6"
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-center text-lg font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim().length === 6 && !loading) {
                    joinHousehold(e.target.value);
                  }
                }}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowJoinHousehold(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.parentElement.querySelector('input');
                    if (input.value.trim().length === 6 && !loading) {
                      joinHousehold(input.value);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:opacity-50"
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

  const ExpenseForm = () => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
      if (description) {
        const suggested = suggestCategory(description);
        setCategory(suggested);
      }
    }, [description]);

    const handleSubmit = () => {
      if (!amount || !description || !category || loading) return;
      addExpense(amount, description, category, date, userName);
      setAmount('');
      setDescription('');
      setCategory('');
      setDate(new Date().toISOString().split('T')[0]);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-sm">
          <h2 className="text-lg font-bold mb-4">Add Expense</h2>
          <div className="space-y-4">
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              required
            />
            <input
              type="text"
              placeholder="What was it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
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
              className="w-full p-3 border border-gray-300 rounded-lg"
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
                disabled={loading}
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
                  <div className="font-bold">${expense.amount.toFixed(2)}</div>
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
              <div className="font-bold">${expense.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const InsightsView = () => {
    const insights = getInsights();

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

        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h3 className="font-bold mb-2">
            Total {insights.period === 'weekly' ? 'This Week' : 'This Month'}
          </h3>
          <div className="text-2xl font-bold text-blue-600">
            ${insights.total.toFixed(2)}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h3 className="font-bold mb-3">Expenses by User</h3>
          {insights.byUser.map(item => (
            <div key={item.user} className="flex justify-between items-center py-2">
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-500" />
                <span>{item.user}</span>
              </div>
              <div className="font-bold">${item.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold mb-3">Expenses by Category</h3>
          {insights.byCategory.map(item => {
            const percentage = insights.total > 0 ? (item.amount / insights.total) * 100 : 0;
            return (
              <div key={item.category} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span>{item.category}</span>
                  <span className="font-bold">${item.amount.toFixed(2)}</span>
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