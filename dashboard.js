// BookedBy Dashboard - Simplified Browser Version
// Uses CSS for visualizations instead of external chart libraries

const { useState, useEffect } = React;

// BookedBy Brand Colors
const COLORS = {
  primary: '#0A5F7F',
  secondary: '#14B8A6',
  accent: '#F59E0B',
  complete: '#10B981',
  inProgress: '#3B82F6',
  ready: '#8B5CF6',
  bg: '#0F172A',
  bgCard: '#1E293B',
  bgLight: '#334155',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#334155'
};

// CONFIGURATION - Your Google Drive file IDs
const GOOGLE_SHEET_ID = '1jiBYlBD3WBMNH-fhGRsENv9KgtRyZ-GYW3UucHx2V_Q';
const GOOGLE_DOC_ID = '1SXPGWbJ1PTMJYclmobCkNi6551L7FfXUobfjbn9jdAk';

function BookedByDashboard() {
  const [tasks, setTasks] = useState([]);
  const [openItems, setOpenItems] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [documentLinks, setDocumentLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchGoogleSheetData(),
        fetchGoogleDocData()
      ]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleSheetData = async () => {
    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
      
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure it is shared as "Anyone with the link can view"');
      }

      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const parsedTasks = jsonData.map((row, index) => ({
        id: index,
        task: row['Task'] || row['task'] || '',
        status: row['Status'] || row['status'] || '',
        target: row['Target'] || row['target'] || '',
        targetCompleted: row['Target Completed Date'] || row['Target_Completed_Date'] || row['targetCompleted'] || '',
        notes: row['Notes'] || row['notes'] || '',
        startDate: row['Start Date'] || row['Start_Date'] || row['startDate'] || ''
      })).filter(task => task.task);

      setTasks(parsedTasks);
    } catch (err) {
      throw new Error(`Google Sheet error: ${err.message}`);
    }
  };

  const fetchGoogleDocData = async () => {
    try {
      const docUrl = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/export?format=txt`;
      
      const response = await fetch(docUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Doc. Make sure it is shared as "Anyone with the link can view"');
      }

      const text = await response.text();
      parseGoogleDocContent(text);
    } catch (err) {
      console.error('Google Doc error:', err);
      setOpenItems([]);
      setActionItems([]);
      setDocumentLinks([]);
    }
  };

  const parseGoogleDocContent = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentSection = null;
    const tempStatusUpdate = [];
    const tempDocLinks = [];
    
    lines.forEach((line) => {
      // Detect Status Update section
      if (line.match(/^#+\s*Status Update/i) || line.match(/^Status Update:?$/i)) {
        currentSection = 'status';
        return;
      }
      // Detect Document Links section
      if (line.match(/^#+\s*Document Links/i) || line.match(/^Document Links:?$/i) || line.match(/^Links:?$/i)) {
        currentSection = 'links';
        return;
      }
      
      if (!line || line.startsWith('#')) return;
      
      if (currentSection === 'status') {
        const cleanText = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        if (cleanText) tempStatusUpdate.push({ id: tempStatusUpdate.length + 1, text: cleanText });
      } else if (currentSection === 'links') {
        const linkMatch = line.match(/^[-*•]?\s*(.+?):\s*(https?:\/\/.+)$/i) || 
                         line.match(/^[-*•]?\s*(.+?)\s*-\s*(https?:\/\/.+)$/i);
        
        if (linkMatch) {
          tempDocLinks.push({
            id: tempDocLinks.length + 1,
            name: linkMatch[1].trim(),
            url: linkMatch[2].trim()
          });
        } else if (line.match(/^https?:\/\//i)) {
          tempDocLinks.push({
            id: tempDocLinks.length + 1,
            name: 'Link',
            url: line.trim()
          });
        }
      }
    });
    
    setOpenItems(tempStatusUpdate); // Reusing openItems state for status update
    setActionItems([]); // Not using action items anymore
    setDocumentLinks(tempDocLinks);
  };

  const getStatusBreakdown = () => {
    const statusCount = tasks.reduce((acc, task) => {
      const status = task.status;
      if (status === 'Complete') acc.complete++;
      else if (status === 'In Progress') acc.inProgress++;
      else if (status === 'Ready' || status === 'Not Started') acc.ready++;
      return acc;
    }, { ready: 0, inProgress: 0, complete: 0 });

    const total = statusCount.ready + statusCount.inProgress + statusCount.complete;
    if (total === 0) return [];
    
    return [
      { name: 'Ready', value: statusCount.ready, percentage: ((statusCount.ready / total) * 100).toFixed(0), color: COLORS.ready },
      { name: 'In Progress', value: statusCount.inProgress, percentage: ((statusCount.inProgress / total) * 100).toFixed(0), color: COLORS.inProgress },
      { name: 'Complete', value: statusCount.complete, percentage: ((statusCount.complete / total) * 100).toFixed(0), color: COLORS.complete }
    ].filter(item => item.value > 0);
  };

  const getRecentlyCompleted = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date();

    return tasks.filter(task => {
      if (task.status !== 'Complete') return false;
      
      // Check target date (7 days before current day)
      if (!task.target) return false;
      
      try {
        // Parse date - handle MM/DD/YY format
        const targetDate = new Date(task.target);
        return targetDate >= sevenDaysAgo && targetDate <= today;
      } catch {
        return false;
      }
    });
  };

  const getUpcoming = () => {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    return tasks.filter(task => {
      if (!task.target) return false;
      
      // Must be Ready or Not Started
      const isRelevantStatus = task.status === 'Ready' || task.status === 'Not Started';
      if (!isRelevantStatus) return false;
      
      try {
        const targetDate = new Date(task.target);
        const isUpcoming = targetDate >= today && targetDate <= sevenDaysFromNow;
        return isUpcoming;
      } catch {
        return false;
      }
    });
  };

  const getInProgress = () => {
    return tasks.filter(task => task.status === 'In Progress');
  };

  const statusData = getStatusBreakdown();
  const recentlyCompleted = getRecentlyCompleted();
  const upcoming = getUpcoming();
  const inProgress = getInProgress();

  const chartColors = {
    'Ready': COLORS.ready,
    'In Progress': COLORS.inProgress,
    'Complete': COLORS.complete
  };

  if (loading) {
    return React.createElement('div', {
      style: { 
        minHeight: '100vh', 
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif"
      }
    },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', {
          style: { 
            width: '60px', 
            height: '60px', 
            border: `4px solid ${COLORS.secondary}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }
        }),
        React.createElement('p', {
          style: { color: COLORS.text, marginTop: '20px', fontSize: '18px' }
        }, 'Loading dashboard...'),
        React.createElement('style', null, `@keyframes spin { to { transform: rotate(360deg); } }`)
      )
    );
  }

  if (error) {
    return React.createElement('div', {
      style: { 
        minHeight: '100vh', 
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        padding: '20px'
      }
    },
      React.createElement('div', {
        style: { 
          background: COLORS.bgCard, 
          padding: '40px', 
          borderRadius: '16px',
          border: `1px solid ${COLORS.border}`,
          maxWidth: '600px'
        }
      },
        React.createElement('h2', {
          style: { color: '#EF4444', marginBottom: '16px', fontSize: '24px' }
        }, 'Configuration Error'),
        React.createElement('p', {
          style: { color: COLORS.text, marginBottom: '20px', lineHeight: '1.6' }
        }, error),
        React.createElement('div', {
          style: { background: COLORS.bgLight, padding: '20px', borderRadius: '8px', marginTop: '20px' }
        },
          React.createElement('p', {
            style: { color: COLORS.textMuted, fontSize: '14px', marginBottom: '12px' }
          }, 'Make sure both files are shared as "Anyone with the link can view"')
        ),
        React.createElement('button', {
          onClick: fetchAllData,
          style: {
            marginTop: '20px',
            background: COLORS.secondary,
            color: COLORS.bg,
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif"
          }
        }, 'Try Again')
      )
    );
  }

  // Main dashboard
  return React.createElement('div', {
    style: { 
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
      padding: '40px 20px',
      fontFamily: "'Space Grotesk', sans-serif"
    }
  },
    React.createElement('link', {
      href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
      rel: "stylesheet"
    }),
    
    // Header
    React.createElement('div', { style: { maxWidth: '1400px', margin: '0 auto', marginBottom: '40px' } },
      React.createElement('div', { 
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }
      },
        React.createElement('div', null,
          React.createElement('h1', {
            style: { color: COLORS.text, fontSize: '48px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }
          },
            'BookedBy',
            React.createElement('span', {
              style: { color: COLORS.secondary, fontSize: '36px', marginLeft: '12px', fontWeight: '400' }
            }, 'Project Dashboard')
          ),
          React.createElement('p', {
            style: { color: COLORS.textMuted, fontSize: '16px', margin: '8px 0 0 0' }
          },
            'Real-time project tracking from Google Drive',
            lastUpdated && React.createElement('span', {
              style: { marginLeft: '12px', fontSize: '14px' }
            }, ` • Updated ${lastUpdated.toLocaleTimeString()}`)
          )
        ),
        React.createElement('button', {
          onClick: fetchAllData,
          disabled: loading,
          style: {
            background: COLORS.secondary,
            color: COLORS.bg,
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            opacity: loading ? 0.6 : 1
          }
        }, '↻ Refresh Data')
      )
    ),
    
    // Main content
    React.createElement('div', { style: { maxWidth: '1400px', margin: '0 auto' } },
      
      // Status Chart with CSS-based donut
      statusData.length > 0 && React.createElement('div', {
        style: { 
          background: COLORS.bgCard,
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '32px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }
      },
        React.createElement('h2', {
          style: { color: COLORS.text, fontSize: '24px', marginBottom: '24px', fontWeight: '600' }
        }, 'Project Status Breakdown'),
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }
        },
          // CSS Donut Chart
          React.createElement('div', { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: '300px' } },
            React.createElement('div', {
              style: {
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                background: `conic-gradient(
                  ${statusData.map((item, idx) => {
                    const prevTotal = statusData.slice(0, idx).reduce((sum, i) => sum + parseFloat(i.percentage), 0);
                    const currentTotal = prevTotal + parseFloat(item.percentage);
                    return `${item.color} ${prevTotal}% ${currentTotal}%`;
                  }).join(', ')}
                )`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            },
              React.createElement('div', {
                style: {
                  width: '160px',
                  height: '160px',
                  borderRadius: '50%',
                  background: COLORS.bgCard,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column'
                }
              },
                React.createElement('div', {
                  style: { color: COLORS.text, fontSize: '32px', fontWeight: '700' }
                }, tasks.length),
                React.createElement('div', {
                  style: { color: COLORS.textMuted, fontSize: '14px' }
                }, 'Total Tasks')
              )
            )
          ),
          // Legend
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
            statusData.map((item, idx) =>
              React.createElement('div', {
                key: idx,
                style: { 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: COLORS.bgLight,
                  borderRadius: '12px',
                  border: `2px solid ${item.color}30`
                }
              },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                  React.createElement('div', {
                    style: { width: '12px', height: '12px', borderRadius: '50%', background: item.color }
                  }),
                  React.createElement('span', {
                    style: { color: COLORS.text, fontSize: '16px', fontWeight: '500' }
                  }, item.name)
                ),
                React.createElement('div', { style: { textAlign: 'right' } },
                  React.createElement('div', {
                    style: { color: item.color, fontSize: '28px', fontWeight: '700', lineHeight: '1' }
                  }, `${item.percentage}%`),
                  React.createElement('div', {
                    style: { color: COLORS.textMuted, fontSize: '14px' }
                  }, `${item.value} tasks`)
                )
              )
            )
          )
        )
      ),
      
      // Grid for Recently Completed, Upcoming, and In Progress
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' } },
        // Recently Completed
        React.createElement('div', {
          style: { 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' } },
            React.createElement('div', { 
              style: { color: COLORS.complete, fontSize: '24px' } 
            }, '✓'),
            React.createElement('h2', {
              style: { color: COLORS.text, fontSize: '20px', margin: 0, fontWeight: '600' }
            }, 'Recently Completed'),
            React.createElement('span', {
              style: { 
                background: COLORS.complete + '20',
                color: COLORS.complete,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }
            }, recentlyCompleted.length)
          ),
          React.createElement('p', {
            style: { color: COLORS.textMuted, fontSize: '14px', marginBottom: '20px' }
          }, 'Completed in the last 7 days'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' } },
            recentlyCompleted.length === 0 ? 
              React.createElement('p', {
                style: { color: COLORS.textMuted, fontStyle: 'italic' }
              }, 'No recently completed tasks') :
              recentlyCompleted.map((task, idx) =>
                React.createElement('div', {
                  key: idx,
                  style: { 
                    background: COLORS.bgLight,
                    padding: '16px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${COLORS.complete}`
                  }
                },
                  React.createElement('div', {
                    style: { color: COLORS.text, fontSize: '15px', fontWeight: '500', marginBottom: '8px' }
                  }, task.task),
                  React.createElement('div', {
                    style: { color: COLORS.textMuted, fontSize: '13px' }
                  }, `Target: ${task.target}`)
                )
              )
          )
        ),
        
        // Upcoming
        React.createElement('div', {
          style: { 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' } },
            React.createElement('div', { 
              style: { color: COLORS.accent, fontSize: '24px' } 
            }, '⏰'),
            React.createElement('h2', {
              style: { color: COLORS.text, fontSize: '20px', margin: 0, fontWeight: '600' }
            }, 'Upcoming Tasks'),
            React.createElement('span', {
              style: { 
                background: COLORS.accent + '20',
                color: COLORS.accent,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }
            }, upcoming.length)
          ),
          React.createElement('p', {
            style: { color: COLORS.textMuted, fontSize: '14px', marginBottom: '20px' }
          }, 'Due within the next 7 days'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' } },
            upcoming.length === 0 ? 
              React.createElement('p', {
                style: { color: COLORS.textMuted, fontStyle: 'italic' }
              }, 'No upcoming tasks') :
              upcoming.map((task, idx) =>
                React.createElement('div', {
                  key: idx,
                  style: { 
                    background: COLORS.bgLight,
                    padding: '16px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${chartColors[task.status] || COLORS.accent}`
                  }
                },
                  React.createElement('div', {
                    style: { color: COLORS.text, fontSize: '15px', fontWeight: '500', marginBottom: '8px' }
                  }, task.task),
                  React.createElement('div', {
                    style: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }
                  },
                    React.createElement('span', {
                      style: { 
                        background: chartColors[task.status] || COLORS.accent,
                        color: COLORS.bg,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }
                    }, task.status),
                    React.createElement('span', {
                      style: { color: COLORS.textMuted }
                    }, `Due: ${task.target}`)
                  )
                )
              )
          )
        ),
        
        // In Progress
        React.createElement('div', {
          style: { 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' } },
            React.createElement('div', { 
              style: { color: COLORS.inProgress, fontSize: '24px' } 
            }, '🔄'),
            React.createElement('h2', {
              style: { color: COLORS.text, fontSize: '20px', margin: 0, fontWeight: '600' }
            }, 'In Progress'),
            React.createElement('span', {
              style: { 
                background: COLORS.inProgress + '20',
                color: COLORS.inProgress,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }
            }, inProgress.length)
          ),
          React.createElement('p', {
            style: { color: COLORS.textMuted, fontSize: '14px', marginBottom: '20px' }
          }, 'Currently in progress'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' } },
            inProgress.length === 0 ? 
              React.createElement('p', {
                style: { color: COLORS.textMuted, fontStyle: 'italic' }
              }, 'No tasks in progress') :
              inProgress.map((task, idx) =>
                React.createElement('div', {
                  key: idx,
                  style: { 
                    background: COLORS.bgLight,
                    padding: '16px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${COLORS.inProgress}`
                  }
                },
                  React.createElement('div', {
                    style: { color: COLORS.text, fontSize: '15px', fontWeight: '500', marginBottom: '8px' }
                  }, task.task),
                  task.target && React.createElement('div', {
                    style: { color: COLORS.textMuted, fontSize: '13px' }
                  }, `Target: ${task.target}`)
                )
              )
          )
        )
      ),
      
      // Status Update Section (full width)
      React.createElement('div', {
        style: { 
          background: COLORS.bgCard,
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '32px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' } },
          React.createElement('div', { 
            style: { color: COLORS.secondary, fontSize: '24px' } 
          }, '📋'),
          React.createElement('h2', {
            style: { color: COLORS.text, fontSize: '20px', margin: 0, fontWeight: '600' }
          }, 'Status Update'),
          React.createElement('span', {
            style: { 
              background: COLORS.secondary + '20',
              color: COLORS.secondary,
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              marginLeft: 'auto'
            }
          }, openItems.length)
        ),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          openItems.length === 0 ? 
            React.createElement('p', {
              style: { color: COLORS.textMuted, fontStyle: 'italic' }
            }, 'No status updates in your Google Doc') :
            openItems.map((item) =>
              React.createElement('div', {
                key: item.id,
                style: { 
                  background: COLORS.bgLight,
                  padding: '14px',
                  borderRadius: '8px'
                }
              },
                React.createElement('span', {
                  style: { color: COLORS.text, fontSize: '14px' }
                }, item.text)
              )
            )
        )
      ),
      
      // Document Links
      documentLinks.length > 0 && React.createElement('div', {
        style: { 
          background: COLORS.bgCard,
          borderRadius: '16px',
          padding: '32px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' } },
          React.createElement('div', { 
            style: { color: COLORS.primary, fontSize: '24px' } 
          }, '🔗'),
          React.createElement('h2', {
            style: { color: COLORS.text, fontSize: '20px', margin: 0, fontWeight: '600' }
          }, 'Document Links'),
          React.createElement('span', {
            style: { 
              background: COLORS.primary + '20',
              color: COLORS.primary,
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              marginLeft: 'auto'
            }
          }, documentLinks.length)
        ),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' } },
          documentLinks.map((link) =>
            React.createElement('a', {
              key: link.id,
              href: link.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { 
                background: COLORS.bgLight,
                padding: '16px',
                borderRadius: '8px',
                color: COLORS.secondary,
                textDecoration: 'none',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              },
              onMouseOver: (e) => {
                e.currentTarget.style.background = COLORS.secondary + '20';
                e.currentTarget.style.transform = 'translateY(-2px)';
              },
              onMouseOut: (e) => {
                e.currentTarget.style.background = COLORS.bgLight;
                e.currentTarget.style.transform = 'translateY(0)';
              }
            },
              React.createElement('span', null, '↗'),
              link.name
            )
          )
        )
      )
    )
  );
}

window.BookedByDashboard = BookedByDashboard;
