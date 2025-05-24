import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Users, BarChart3, Calendar, User, Home, TrendingUp, PieChart } from 'lucide-react';

const BudgetTracker = () => {
  // State management
  const [currentView, setCurrentView] = useState('expenses');
  const [households, setHouseholds] = useState([]);
  const [currentHousehold, setCurrentHousehold] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [userName, setUserName] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showJoinHousehold, setShowJoinHousehold] = useState(false);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [insightsPeriod, setInsightsPeriod] = useState('monthly');

  // Pre-defined categories with learning capability
  const defaultCategories = [
    'Groceries', 'Restaurants', 'Transportation', 'Utilities', 
    'Entertainment', 'Shopping', 'Healthcare', 'Cigarettes', 'Other'
  ];

  // Load data from localStorage on mount
  useEffect(() => {
    const savedHouseholds = JSON.parse(localStorage.getItem('households') || '[]');
    const savedExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    const savedUserName = localStorage.getItem('userName') || '';
    const savedCurrentHousehold = localStorage.getItem('currentHousehold');
    
    setHouseholds(savedHouseholds);
    setExpenses(savedExpenses);
    setUserName(savedUserName);
    
    if (savedCurrentHousehold) {
      const household = savedHouseholds.find(h => h.id === savedCurrentHousehold);
      if (household) setCurrentHousehold(household);
    }
  }, []);

  // Save data to localStorage
  const saveToStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Generate 6-digit invite code
  const generateInviteCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Smart category suggestion based on description
  const suggestCategory = (description, householdId) => {
    const householdExpenses = expenses.filter(e => e.householdId === householdId);
    const patterns = {};
    
    // Build patterns from existing expenses
    householdExpenses.forEach(expense => {
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

  // Create household
  const createHousehold = (name) => {
    if (!userName.trim()) {
      alert('Please enter your name first');
      return;
    }

    const newHousehold = {
      id: Date.now().toString(),
      name: name.trim(),
      inviteCode: generateInviteCode(),
      members: [userName.trim()],
      createdBy: userName.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedHouseholds = [...households, newHousehold];
    setHouseholds(updatedHouseholds);
    setCurrentHousehold(newHousehold);
    saveToStorage('households', updatedHouseholds);
    localStorage.setItem('currentHousehold', newHousehold.id);
    localStorage.setItem('userName', userName.trim());
    setShowCreateHousehold(false);
  };

  // Join household
  const joinHousehold = (inviteCode) => {
    if (!userName.trim()) {
      alert('Please enter your name first');
      return;
    }

    const household = households.find(h => h.inviteCode === inviteCode.trim());
    if (!household) {
      alert('Invalid invite code');
      return;
    }

    if (!household.members.includes(userName.trim())) {
      household.members.push(userName.trim());
      const updatedHouseholds = households.map(h => h.id === household.id ? household : h);
      setHouseholds(updatedHouseholds);
      saveToStorage('households', updatedHouseholds);
    }

    setCurrentHousehold(household);
    localStorage.setItem('currentHousehold', household.id);
    localStorage.setItem('userName', userName.trim());
    setShowJoinHousehold(false);
  };

  // Add expense
  const addExpense = (amount, description, category, date, user) => {
    const newExpense = {
      id: Date.now().toString(),
      householdId: currentHousehold.id,
      amount: parseFloat(amount),
      description: description.trim(),
      category,
      date,
      user,
      createdAt: new Date().toISOString()
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    saveToStorage('expenses', updatedExpenses);
    setShowAddExpense(false);
  };

  // Get expenses for current household
  const householdExpenses = useMemo(() => {
    if (!currentHousehold) return [];
    return expenses
      .filter(e => e.householdId === currentHousehold.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, currentHousehold]);

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
            className="w-full bg-blue-500 text-white p-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Create New Household
          </button>
          
          <button
            onClick={() => setShowJoinHousehold(true)}
            className="w-full bg-gray-500 text-white p-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Join Household
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
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    createHousehold(e.target.value);
                  }
                }}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCreateHousehold(false)}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.parentElement.querySelector('input');
                    if (input.value.trim()) {
                      createHousehold(input.value);
                    }
                  }}
                  className="flex-1 bg-blue-500 text-white p-2 rounded-lg"
                >
                  Create
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
                  if (e.key === 'Enter' && e.target.value.trim().length === 6) {
                    joinHousehold(e.target.value);
                  }
                }}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowJoinHousehold(false)}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.parentElement.querySelector('input');
                    if (input.value.trim().length === 6) {
                      joinHousehold(input.value);
                    }
                  }}
                  className="flex-1 bg-blue-500 text-white p-2 rounded-lg"
                >
                  Join
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
      if (description && currentHousehold) {
        const suggested = suggestCategory(description, currentHousehold.id);
        setCategory(suggested);
      }
    }, [description]);

    const handleSubmit = () => {
      if (!amount || !description || !category) return;
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
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg"
              >
                Add
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
            {currentHousehold.members.length} member{currentHousehold.members.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => setShowAddExpense(true)}
          className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
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
