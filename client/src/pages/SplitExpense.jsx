import React, { useState, useEffect } from 'react';
import { 
  createSplitExpense, 
  fetchSplitExpenses,
  deleteSplitExpense
} from '../api/splitExpenseApi';
import { fetchFriends } from '../api/friendsApi';
import { sendExpenseNotification } from '../api/notificationApi';
import './SplitExpense.css';
import CurrencyManager from '../utils/currencyManager';

import enhancedDebtApiService from '../api/DebtApiService';
const SplitExpense = () => {
  // State
  const [friends, setFriends] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [whoPaid, setWhoPaid] = useState('self')
  const [customSplits, setCustomSplits] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [userCurrency, setUserCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  const [formData, setFormData] = useState({
    description: '',
    totalAmount: '',
    splitType: 'equal'
  });
  
  const [notification, setNotification] = useState({ 
    show: false, 
    message: '', 
    type: '' 
  });

  const [debtSummary, setDebtSummary] = useState({
  totalLent: 0,
  totalOwed: 0,
  netBalance: 0
  });

  // Load data on mount
  useEffect(() => {
    const loadCurrency = async () => {
    const { currency, symbol } = await CurrencyManager.fetchFromDB();
    setUserCurrency(currency);
    setCurrencySymbol(symbol);
    console.log('💰 SplitExpense.jsx currency loaded:', currency, symbol);
  };
  loadCurrency();
    loadData();
  }, []);

  const loadDebtSummary = async () => {
  try {
    console.log('📊 Loading debt summary...');
    
    const [owedToMeRes, owedByMeRes] = await Promise.all([
      enhancedDebtApiService.fetchDebtsOwedToMe(),
      enhancedDebtApiService.fetchDebtsOwedByMe()
    ]);

    if (owedToMeRes.success && owedByMeRes.success) {
      // Filter only split expense debts that are pending
      const splitDebtsOwedToMe = (owedToMeRes.debts || [])
        .filter(debt => debt.type === 'split' && debt.status === 'pending');
      
      const splitDebtsOwedByMe = (owedByMeRes.debts || [])
        .filter(debt => debt.type === 'split' && debt.status === 'pending');

      const totalLent = splitDebtsOwedToMe.reduce((sum, debt) => sum + (debt.amount || 0), 0);
      const totalOwed = splitDebtsOwedByMe.reduce((sum, debt) => sum + (debt.amount || 0), 0);

      setDebtSummary({
        totalLent: totalLent.toFixed(2),
        totalOwed: totalOwed.toFixed(2),
        netBalance: (totalLent - totalOwed).toFixed(2)
      });

      console.log('✅ Debt Summary:', {
        splitDebtsOwedToMe: splitDebtsOwedToMe.length,
        splitDebtsOwedByMe: splitDebtsOwedByMe.length,
        totalLent: totalLent.toFixed(2),
        totalOwed: totalOwed.toFixed(2)
      });
    } else {
      console.warn('⚠️ Failed to load debts:', {
        owedToMe: owedToMeRes.message,
        owedByMe: owedByMeRes.message
      });
    }
  } catch (error) {
    console.error('❌ Error loading debt summary:', error);
  }
};

const loadData = async () => {
  setLoading(true);
  try {
    const [friendsRes, expensesRes] = await Promise.all([
      fetchFriends(),
      fetchSplitExpenses()
    ]);

    if (friendsRes.success) {
      const friendsList = friendsRes.friends || [];
      console.log('✅ Loaded friends:', friendsList);
      setFriends(friendsList);
    } else {
      console.error('❌ Failed to load friends:', friendsRes);
      showNotification('Failed to load friends', 'error');
    }

    if (expensesRes.success) {
      setExpenses(expensesRes.expenses || []);
    }

    // 🔥 NEW: Load debt summary for split expenses
    await loadDebtSummary();

  } catch (error) {
    console.error('Error loading data:', error);
    showNotification('Failed to load data', 'error');
  } finally {
    setLoading(false);
  }
};

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f._id === friend._id);
      if (isSelected) {
        const updated = prev.filter(f => f._id !== friend._id);
        const { [friend._id]: removed, ...rest } = customSplits;
        setCustomSplits(rest);
        
        if (whoPaid === friend._id) {
          setWhoPaid('self');
        }
        
        return updated;
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleCustomSplitChange = (friendId, amount) => {
    setCustomSplits(prev => ({
      ...prev,
      [friendId]: parseFloat(amount) || 0
    }));
  };

  const getAmountPerPerson = () => {
    const total = parseFloat(formData.totalAmount) || 0;
    const totalPeople = selectedFriends.length + 1;
    return totalPeople > 0 ? (total / totalPeople).toFixed(2) : 0;
  };

  const validateForm = () => {
    if (!formData.description.trim()) {
      showNotification('Please enter a description', 'error');
      return false;
    }

    const amount = parseFloat(formData.totalAmount);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return false;
    }

    if (selectedFriends.length === 0) {
      showNotification('Please select at least one friend', 'error');
      return false;
    }

    if (formData.splitType === 'custom') {
      const totalCustom = Object.values(customSplits).reduce(
        (sum, val) => sum + (parseFloat(val) || 0), 0
      );
      if (Math.abs(totalCustom - amount) > 0.01) {
        showNotification('Custom splits must equal total amount', 'error');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const total = parseFloat(formData.totalAmount);
      const totalPeople = selectedFriends.length + 1;
      const amountPerPerson = total / totalPeople;

      // Build splits with proper friend data
      const splits = selectedFriends.map(friend => {
        const splitData = {
          amount: formData.splitType === 'equal' 
            ? amountPerPerson
            : (customSplits[friend._id] || 0),
          friendId: friend._id  // This is the Friend document ID
        };

        console.log('Split for friend:', friend.name, splitData);
        return splitData;
      });

      const expenseData = {
        description: formData.description.trim(),
        totalAmount: total,
        paidBy: whoPaid,
        splitType: formData.splitType,
        splits: splits
      };

      console.log('Submitting expense data:', expenseData);

      const response = await createSplitExpense(expenseData);

      if (response.success) {
      const summary = response.summary || {};
      
      showNotification(
        `✅ Expense created! ${summary.debtsCreated} debts and ${summary.notificationsSent} notifications sent.`,
        'success'
      );
        
        // 🔥 FIXED: Extract User IDs correctly from Friend objects
        try {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const whoPaidName = whoPaid === 'self' ? currentUser.name : 
                             selectedFriends.find(f => f._id === whoPaid)?.name || 'Someone';
          
          // Debug: Log friend structure
          console.log('🔍 Analyzing Friend objects for User IDs:');
          selectedFriends.forEach((friend, index) => {
            console.log(`Friend ${index + 1}: ${friend.name}`, {
              friendDocId: friend._id,
              friendUser: friend.friendUser,
              userId: friend.userId,
              user: friend.user,
              allKeys: Object.keys(friend)
            });
          });
          
          // 🎯 CRITICAL FIX: Get actual User IDs from Friend objects
          const friendUserIds = selectedFriends
            .map(friend => {
              // Method 1: friendUser is a populated object
              if (friend.friendUser && typeof friend.friendUser === 'object' && friend.friendUser._id) {
                console.log(`✅ Found User ID from friendUser object: ${friend.friendUser._id} for ${friend.name}`);
                return friend.friendUser._id;
              }
              
              // Method 2: friendUser is just an ID string
              if (friend.friendUser && typeof friend.friendUser === 'string') {
                console.log(`✅ Found User ID from friendUser string: ${friend.friendUser} for ${friend.name}`);
                return friend.friendUser;
              }
              
              // Method 3: userId field exists
              if (friend.userId) {
                console.log(`✅ Found User ID from userId field: ${friend.userId} for ${friend.name}`);
                return friend.userId;
              }
              
              // Method 4: user field exists (string)
              if (friend.user && typeof friend.user === 'string') {
                console.log(`✅ Found User ID from user field: ${friend.user} for ${friend.name}`);
                return friend.user;
              }
              
              // Method 5: user field exists (object)
              if (friend.user && typeof friend.user === 'object' && friend.user._id) {
                console.log(`✅ Found User ID from user object: ${friend.user._id} for ${friend.name}`);
                return friend.user._id;
              }
              
              console.warn(`⚠️ Could not find User ID for friend: ${friend.name}`, {
                friendId: friend._id,
                availableFields: Object.keys(friend)
              });
              return null;
            })
            .filter(id => id); // Remove null/undefined values
          
          console.log('📧 Extracted Friend User IDs for notifications:', friendUserIds);
          console.log('📊 Summary: Total friends:', selectedFriends.length, '| Valid User IDs:', friendUserIds.length);
          
          if (friendUserIds.length === 0) {
            console.error('❌ CRITICAL: No valid User IDs found for notifications!');
            console.log('📋 Full Friend objects:', JSON.stringify(selectedFriends, null, 2));
            showNotification('⚠️ Expense created but could not notify friends (no valid User IDs)', 'warning');
          } else {
            // Calculate individual shares for notification
            const sharePerPerson = formData.splitType === 'equal' ? amountPerPerson.toFixed(2) : null;
            
            console.log('📤 Sending notifications with data:', {
              expenseId: response.expense?._id || response.data?._id,
              recipientCount: friendUserIds.length,
              recipients: friendUserIds,
              description: formData.description,
              totalAmount: total,
              sharePerPerson: sharePerPerson
            });
            
            const notificationResult = await sendExpenseNotification({
              expenseId: response.expense?._id || response.data?._id,
              friendIds: friendUserIds,  // Now sending correct User IDs
              type: 'expense_created',
              data: {
                description: formData.description,
                amount: total,
                paidBy: whoPaidName,
                yourShare: sharePerPerson,
                totalAmount: total
              }
            });
            
            console.log('📬 Notification result:', notificationResult);
            
            if (notificationResult.success) {
              const notifiedCount = notificationResult.count || friendUserIds.length;
              const skippedCount = notificationResult.skipped || 0;
              
              console.log(`✅ Notifications sent successfully: ${notifiedCount} sent, ${skippedCount} skipped`);
              
              if (skippedCount > 0) {
                showNotification(`✅ Expense created! ${notifiedCount} friends notified (${skippedCount} skipped)`, 'success');
              } else {
                showNotification('✅ Expense created & all friends notified!', 'success');
              }
            } else {
              console.warn('⚠️ Notifications failed:', notificationResult.message);
              showNotification(`⚠️ Expense created but notifications failed: ${notificationResult.message}`, 'warning');
            }
          }
        } catch (notifError) {
          console.error('❌ Error in notification process:', notifError);
          console.error('Stack trace:', notifError.stack);
          showNotification('Expense created but notifications failed', 'warning');
        }
        
        // Reset form
        setFormData({ description: '', totalAmount: '', splitType: 'equal' });
        setSelectedFriends([]);
        setWhoPaid('self');
        setCustomSplits({});
        
        await loadDebtSummary();
        // Reload expenses
        const expensesRes = await fetchSplitExpenses();
        if (expensesRes.success) {
          setExpenses(expensesRes.expenses || []);
        }
        
        // Switch to history tab
        setActiveTab('history');
      } else {
        showNotification(response.message || 'Failed to create expense', 'error');
      }
    } catch (error) {
      console.error('❌ Error in handleSubmit:', error);
      console.error('Stack trace:', error.stack);
      showNotification('Failed to create split expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;

    try {
      const response = await deleteSplitExpense(expenseId);
      
      if (response.success) {
        showNotification('Expense deleted successfully', 'success');
        const expensesRes = await fetchSplitExpenses();
        if (expensesRes.success) {
          setExpenses(expensesRes.expenses || []);
        }
        setSelectedExpense(null);
      } else {
        showNotification(response.message || 'Failed to delete', 'error');
      }
    } catch (error) {
      showNotification('Failed to delete expense', 'error');
    }
  };

  const filteredFriends = friends.filter(friend => 
    friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpenses = filterStatus === 'all' 
    ? expenses 
    : expenses.filter(exp => exp.status === filterStatus);

  const getWhoPaidName = (expense) => {
    const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')._id;
    
    if (expense.paidBy === 'self') {
      return 'You';
    }
    
    if (typeof expense.paidBy === 'object' && expense.paidBy !== null && expense.paidBy.name) {
      if (expense.paidBy._id === currentUserId) {
        return 'You';
      }
      return expense.paidBy.name;
    }
    
    if (typeof expense.paidBy === 'string') {
      if (expense.paidBy === currentUserId) {
        return 'You';
      }
      
      const friendWhoPaid = friends.find(f => f._id === expense.paidBy);
      if (friendWhoPaid) {
        return friendWhoPaid.name;
      }
      
      const friendByUserId = friends.find(f => f.friendUser?._id === expense.paidBy || f.friendUser === expense.paidBy);
      if (friendByUserId) {
        return friendByUserId.name;
      }
    }
    
    return 'Friend';
  };

  const summary = debtSummary;

  if (loading) {
    return (
      <div className="split-expense-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="split-expense-container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>
            ×
          </button>
        </div>
      )}

      <div className="split-expense-header">
        <h1>💰 Split Expenses</h1>
        <p>Split bills with friends easily</p>
      </div>

      <div className="summary-cards">
        <div className="summary-card green">
          <div className="summary-icon">↑</div>
          <div className="summary-content">
            <p className="summary-label">You'll Get</p>
            <h3 className="summary-value">{currencySymbol}{summary.totalLent}</h3>
          </div>
        </div>
        <div className="summary-card red">
          <div className="summary-icon">↓</div>
          <div className="summary-content">
            <p className="summary-label">You Owe</p>
            <h3 className="summary-value">{currencySymbol}{summary.totalOwed}</h3>
          </div>
        </div>
        <div className="summary-card blue">
          <div className="summary-icon">≈</div>
          <div className="summary-content">
            <p className="summary-label">Net Balance</p>
            <h3 className="summary-value">{currencySymbol}{summary.netBalance}</h3>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Split
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History ({expenses.length})
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="create-split-section">
          <form onSubmit={handleSubmit} className="split-form">
            <div className="form-section">
              <h3>Expense Details</h3>
              
              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g., Dinner at restaurant"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="totalAmount">Total Amount *</label>
                <div className="amount-input">
                  <span className="currency">{currencySymbol}</span>
                  <input
                    type="number"
                    id="totalAmount"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="splitType">Split Type</label>
                <select
                  id="splitType"
                  name="splitType"
                  value={formData.splitType}
                  onChange={handleInputChange}
                >
                  <option value="equal">Split Equally</option>
                  <option value="custom">Custom Split</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Select Friends ({selectedFriends.length} selected)</h3>
              
              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {friends.length === 0 ? (
                <div className="empty-state">
                  <p>No friends found. Add friends first!</p>
                </div>
              ) : (
                <div className="friends-list">
                  {filteredFriends.map(friend => {
                    const isSelected = selectedFriends.some(f => f._id === friend._id);
                    return (
                      <div 
                        key={friend._id} 
                        className={`friend-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleFriendSelection(friend)}
                      >
                        <div className="friend-info">
                          <div className="friend-avatar">
                            {friend.profilePicture ? (
                              <img src={friend.profilePicture} alt={friend.name} />
                            ) : (
                              <span>{friend.name?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="friend-details">
                            <h4>{friend.name}</h4>
                            <p>{friend.email}</p>
                          </div>
                        </div>
                        
                        {isSelected && formData.splitType === 'custom' && (
                          <div className="custom-amount" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              placeholder="Amount"
                              value={customSplits[friend._id] || ''}
                              onChange={(e) => handleCustomSplitChange(friend._id, e.target.value)}
                              step="0.01"
                              min="0"
                            />
                          </div>
                        )}
                        
                        <div className="friend-checkbox">
                          {isSelected && <span className="checkmark">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {selectedFriends.length > 0 && (
              <div className="form-group">
                <label htmlFor="whoPaid">Who Paid? *</label>
                <select
                  id="whoPaid"
                  name="whoPaid"
                  value={whoPaid}
                  onChange={(e) => setWhoPaid(e.target.value)}
                  className="who-paid-select"
                >
                  <option value="self">💰 I Paid</option>
                  <optgroup label="Friends in this split">
                    {selectedFriends.map(friend => (
                      <option key={friend._id} value={friend._id}>
                        {friend.name} Paid
                      </option>
                    ))}
                  </optgroup>
                </select>
                <small className="helper-text">
                  {whoPaid === 'self' 
                    ? 'You paid for this expense' 
                    : `${selectedFriends.find(f => f._id === whoPaid)?.name || 'Friend'} paid for this expense`}
                </small>
              </div>
            )}

            {selectedFriends.length > 0 && formData.totalAmount && (
              <div className="split-summary">
                <h3>Split Summary</h3>
                <div className="summary-content">
                  <div className="summary-row total">
                    <span>Total Amount:</span>
                    <span>{currencySymbol}{parseFloat(formData.totalAmount).toFixed(2)}</span>
                  </div>
                  
                  {formData.splitType === 'equal' && (
                    <>
                      <div className="summary-row">
                        <span>Split between:</span>
                        <span>{selectedFriends.length + 1} people</span>
                      </div>
                      <div className="summary-row">
                        <span>Amount per person:</span>
                        <span>{currencySymbol}{getAmountPerPerson()}</span>
                      </div>
                    </>
                  )}

                  <div className="participants">
                    <h4>{whoPaid === 'self' ? 'You (Paid)' : `${friends.find(f => f._id === whoPaid)?.name || 'Friend'} (Paid)`}</h4>
                    {selectedFriends.map(friend => (
                      <div key={friend._id} className="participant">
                        <span>{friend.name}</span>
                        <span className="owes">
                          Owes {currencySymbol}{formData.splitType === 'equal' 
                            ? getAmountPerPerson() 
                            : (customSplits[friend._id] || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={submitting || selectedFriends.length === 0}
            >
              {submitting ? 'Creating...' : '✨ Create Split Expense'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <div className="history-header">
            <h3>Expense History</h3>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
              <button 
                className={`filter-btn ${filterStatus === 'settled' ? 'active' : ''}`}
                onClick={() => setFilterStatus('settled')}
              >
                Settled
              </button>
            </div>
          </div>
          
          {filteredExpenses.length === 0 ? (
            <div className="empty-state">
              <p>No expenses found. Create your first split!</p>
              <button 
                className="btn-primary"
                onClick={() => setActiveTab('create')}
              >
                Create Split
              </button>
            </div>
          ) : (
            <div className="expenses-grid">
              {filteredExpenses.map(expense => (
                <div 
                  key={expense._id} 
                  className="expense-card"
                  onClick={() => setSelectedExpense(
                    selectedExpense?._id === expense._id ? null : expense
                  )}
                >
                  <div className="expense-header">
                    <h4>{expense.description}</h4>
                    <span className={`status ${expense.status}`}>
                      {expense.status}
                    </span>
                  </div>
                  
                  <div className="expense-amount">
                    <span className="label">Total:</span>
                    <span className="amount">{currencySymbol}{expense.totalAmount}</span>
                  </div>
                  
                  <div className="expense-info">
                    <p>💳 Paid by: <strong>{getWhoPaidName(expense)}</strong></p>
                    <p>👥 Split with: <strong>{expense.splits?.length || 0} people</strong></p>
                    <p>📅 Date: {new Date(expense.createdAt).toLocaleDateString()}</p>
                  </div>
                  
                  {selectedExpense?._id === expense._id && (
                    <div className="expense-details">
                      <div className="expense-splits">
                        <h4>Split Details:</h4>
                        {expense.splits?.map((split, index) => (
                          <div key={index} className="split-item">
                            <span>{split.friendId?.name || split.email}</span>
                            <span>{currencySymbol}{split.amount}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="expense-actions">
                        <button 
                          className="action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpense(expense._id);
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SplitExpense;