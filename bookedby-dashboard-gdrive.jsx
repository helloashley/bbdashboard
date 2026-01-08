import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Calendar, CheckCircle, Clock, RefreshCw, ExternalLink, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

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
const GOOGLE_SHEET_ID = '1jiBYlBD3WBMNH-fhGRsENv9KgtRyZ-GYW3UucHx2V_Q'; // Your main Google Sheet
const GOOGLE_DOC_ID = '1SXPGWbJ1PTMJYclmobCkNi6551L7FfXUobfjbn9jdAk'; // Your Google Doc with Open Items/Action Items/Links

export default function BookedByDashboard() {
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
      // Google Sheets CSV export URL - much simpler than Excel!
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
      
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure it is shared as "Anyone with the link can view"');
      }

      const csvText = await response.text();
      
      // Parse CSV using SheetJS
      const workbook = XLSX.read(csvText, { type: 'string' });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Parse the data
      const parsedTasks = jsonData.map((row, index) => ({
        id: index,
        task: row['Task'] || row['task'] || '',
        status: row['Status'] || row['status'] || '',
        target: row['Target'] || row['target'] || '',
        targetCompleted: row['Target Completed Date'] || row['Target_Completed_Date'] || row['targetCompleted'] || '',
        notes: row['Notes'] || row['notes'] || '',
        startDate: row['Start Date'] || row['Start_Date'] || row['startDate'] || ''
      })).filter(task => task.task); // Filter out empty rows

      setTasks(parsedTasks);
    } catch (err) {
      throw new Error(`Google Sheet error: ${err.message}`);
    }
  };

  const fetchGoogleDocData = async () => {
    try {
      if (GOOGLE_DOC_ID === 'YOUR_GOOGLE_DOC_ID_HERE') {
        // Skip if not configured yet
        setOpenItems([
          { id: 1, text: 'Add your Google Doc ID to see live data here' },
          { id: 2, text: 'Instructions in README.md' }
        ]);
        setActionItems([
          { id: 1, text: 'Configure Google Doc ID in the dashboard code' }
        ]);
        setDocumentLinks([
          { id: 1, name: 'Setup Instructions', url: 'README.md' }
        ]);
        return;
      }

      // Export Google Doc as plain text
      const docUrl = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/export?format=txt`;
      
      const response = await fetch(docUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Doc. Make sure it is shared as "Anyone with the link can view"');
      }

      const text = await response.text();
      
      // Parse the document
      parseGoogleDocContent(text);
    } catch (err) {
      console.error('Google Doc error:', err);
      // Don't throw - just use empty arrays if doc fails
      setOpenItems([]);
      setActionItems([]);
      setDocumentLinks([]);
    }
  };

  const parseGoogleDocContent = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentSection = null;
    const tempOpenItems = [];
    const tempActionItems = [];
    const tempDocLinks = [];
    
    lines.forEach((line, index) => {
      // Detect section headers
      if (line.match(/^#+\s*Open Items/i) || line.match(/^Open Items:?$/i)) {
        currentSection = 'open';
        return;
      }
      if (line.match(/^#+\s*Action Items/i) || line.match(/^Action Items:?$/i)) {
        currentSection = 'action';
        return;
      }
      if (line.match(/^#+\s*Document Links/i) || line.match(/^Document Links:?$/i) || line.match(/^Links:?$/i)) {
        currentSection = 'links';
        return;
      }
      
      // Skip empty lines and section headers
      if (!line || line.startsWith('#')) return;
      
      // Parse content based on current section
      if (currentSection === 'open') {
        // Remove bullet points, numbers, dashes
        const cleanText = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        if (cleanText) {
          tempOpenItems.push({ id: tempOpenItems.length + 1, text: cleanText });
        }
      } else if (currentSection === 'action') {
        const cleanText = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        if (cleanText) {
          tempActionItems.push({ id: tempActionItems.length + 1, text: cleanText });
        }
      } else if (currentSection === 'links') {
        // Parse links - format: "Name: URL" or "Name - URL" or just "URL"
        const linkMatch = line.match(/^[-*•]?\s*(.+?):\s*(https?:\/\/.+)$/i) || 
                         line.match(/^[-*•]?\s*(.+?)\s*-\s*(https?:\/\/.+)$/i);
        
        if (linkMatch) {
          tempDocLinks.push({
            id: tempDocLinks.length + 1,
            name: linkMatch[1].trim(),
            url: linkMatch[2].trim()
          });
        } else if (line.match(/^https?:\/\//i)) {
          // Just a URL without a name
          tempDocLinks.push({
            id: tempDocLinks.length + 1,
            name: line.substring(0, 50) + '...',
            url: line.trim()
          });
        }
      }
    });
    
    setOpenItems(tempOpenItems);
    setActionItems(tempActionItems);
    setDocumentLinks(tempDocLinks);
  };

  // Calculate metrics
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
      { name: 'Ready', value: statusCount.ready, percentage: ((statusCount.ready / total) * 100).toFixed(0) },
      { name: 'In Progress', value: statusCount.inProgress, percentage: ((statusCount.inProgress / total) * 100).toFixed(0) },
      { name: 'Complete', value: statusCount.complete, percentage: ((statusCount.complete / total) * 100).toFixed(0) }
    ].filter(item => item.value > 0);
  };

  const getRecentlyCompleted = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return tasks.filter(task => {
      if (task.status !== 'Complete' || !task.targetCompleted) return false;
      try {
        const completedDate = new Date(task.targetCompleted);
        return completedDate >= sevenDaysAgo && completedDate <= new Date();
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
      try {
        const targetDate = new Date(task.target);
        const isUpcoming = targetDate >= today && targetDate <= sevenDaysFromNow;
        const isRelevantStatus = ['Ready', 'Not Started', 'In Progress'].includes(task.status);
        return isUpcoming && isRelevantStatus;
      } catch {
        return false;
      }
    });
  };

  const statusData = getStatusBreakdown();
  const recentlyCompleted = getRecentlyCompleted();
  const upcoming = getUpcoming();

  const chartColors = {
    'Ready': COLORS.ready,
    'In Progress': COLORS.inProgress,
    'Complete': COLORS.complete
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: `4px solid ${COLORS.secondary}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ color: COLORS.text, marginTop: '20px', fontSize: '18px' }}>Loading dashboard...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        padding: '20px'
      }}>
        <div style={{ 
          background: COLORS.bgCard, 
          padding: '40px', 
          borderRadius: '16px',
          border: `1px solid ${COLORS.border}`,
          maxWidth: '600px'
        }}>
          <h2 style={{ color: '#EF4444', marginBottom: '16px', fontSize: '24px' }}>Configuration Error</h2>
          <p style={{ color: COLORS.text, marginBottom: '20px', lineHeight: '1.6' }}>{error}</p>
          <div style={{ background: COLORS.bgLight, padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '12px' }}>
              Make sure your files are shared correctly:
            </p>
            <ol style={{ color: COLORS.text, fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>Right-click your file in Google Drive</li>
              <li>Click "Share"</li>
              <li>Change to "Anyone with the link can view"</li>
              <li>Copy the file ID from the URL</li>
              <li>Update the IDs in the dashboard code</li>
            </ol>
          </div>
          <button
            onClick={fetchAllData}
            style={{
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
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${COLORS.bg} 0%, #1a2942 100%)`,
      padding: '40px 20px',
      fontFamily: "'Space Grotesk', sans-serif"
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', marginBottom: '40px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ 
              color: COLORS.text, 
              fontSize: '48px', 
              fontWeight: '700',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              BookedBy
              <span style={{ 
                color: COLORS.secondary, 
                fontSize: '36px',
                marginLeft: '12px',
                fontWeight: '400'
              }}>
                Project Dashboard
              </span>
            </h1>
            <p style={{ 
              color: COLORS.textMuted, 
              fontSize: '16px',
              margin: '8px 0 0 0'
            }}>
              Real-time project tracking from Google Drive
              {lastUpdated && (
                <span style={{ marginLeft: '12px', fontSize: '14px' }}>
                  • Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchAllData}
            disabled={loading}
            style={{
              background: COLORS.secondary,
              color: COLORS.bg,
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: loading ? 0.6 : 1
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <RefreshCw size={16} />
            Refresh Data
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Status Chart */}
        {statusData.length > 0 && (
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ 
              color: COLORS.text, 
              fontSize: '24px', 
              marginBottom: '24px',
              fontWeight: '600'
            }}>
              Project Status Breakdown
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: COLORS.bgLight, 
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '8px',
                      color: COLORS.text
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {statusData.map((item, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: COLORS.bgLight,
                    borderRadius: '12px',
                    border: `2px solid ${chartColors[item.name]}30`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        background: chartColors[item.name]
                      }} />
                      <span style={{ color: COLORS.text, fontSize: '16px', fontWeight: '500' }}>
                        {item.name}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        color: chartColors[item.name], 
                        fontSize: '28px', 
                        fontWeight: '700',
                        lineHeight: '1'
                      }}>
                        {item.percentage}%
                      </div>
                      <div style={{ color: COLORS.textMuted, fontSize: '14px' }}>
                        {item.value} tasks
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grid for Recently Completed and Upcoming */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
          {/* Recently Completed */}
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <CheckCircle size={24} color={COLORS.complete} />
              <h2 style={{ 
                color: COLORS.text, 
                fontSize: '20px', 
                margin: 0,
                fontWeight: '600'
              }}>
                Recently Completed
              </h2>
              <span style={{ 
                background: COLORS.complete + '20',
                color: COLORS.complete,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {recentlyCompleted.length}
              </span>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '20px' }}>
              Completed in the last 7 days
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {recentlyCompleted.length === 0 ? (
                <p style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>No recently completed tasks</p>
              ) : (
                recentlyCompleted.map((task, idx) => (
                  <div key={idx} style={{ 
                    background: COLORS.bgLight,
                    padding: '16px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${COLORS.complete}`
                  }}>
                    <div style={{ color: COLORS.text, fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
                      {task.task}
                    </div>
                    <div style={{ color: COLORS.textMuted, fontSize: '13px' }}>
                      Completed: {task.targetCompleted}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming */}
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Clock size={24} color={COLORS.accent} />
              <h2 style={{ 
                color: COLORS.text, 
                fontSize: '20px', 
                margin: 0,
                fontWeight: '600'
              }}>
                Upcoming Tasks
              </h2>
              <span style={{ 
                background: COLORS.accent + '20',
                color: COLORS.accent,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {upcoming.length}
              </span>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '20px' }}>
              Due within the next 7 days
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {upcoming.length === 0 ? (
                <p style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>No upcoming tasks</p>
              ) : (
                upcoming.map((task, idx) => (
                  <div key={idx} style={{ 
                    background: COLORS.bgLight,
                    padding: '16px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${chartColors[task.status] || COLORS.accent}`
                  }}>
                    <div style={{ color: COLORS.text, fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
                      {task.task}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      fontSize: '13px'
                    }}>
                      <span style={{ 
                        background: chartColors[task.status] || COLORS.accent,
                        color: COLORS.bg,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {task.status}
                      </span>
                      <span style={{ color: COLORS.textMuted }}>
                        Due: {task.target}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Editable Sections from Google Doc */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
          {/* Open Items */}
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <FileText size={24} color={COLORS.secondary} />
              <h2 style={{ 
                color: COLORS.text, 
                fontSize: '20px', 
                margin: 0,
                fontWeight: '600'
              }}>
                Open Items
              </h2>
              <span style={{ 
                background: COLORS.secondary + '20',
                color: COLORS.secondary,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {openItems.length}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {openItems.length === 0 ? (
                <p style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>
                  No open items in your Google Doc
                </p>
              ) : (
                openItems.map((item) => (
                  <div key={item.id} style={{ 
                    background: COLORS.bgLight,
                    padding: '14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: COLORS.text, fontSize: '14px' }}>{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Items */}
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <CheckCircle size={24} color={COLORS.accent} />
              <h2 style={{ 
                color: COLORS.text, 
                fontSize: '20px', 
                margin: 0,
                fontWeight: '600'
              }}>
                Action Items
              </h2>
              <span style={{ 
                background: COLORS.accent + '20',
                color: COLORS.accent,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {actionItems.length}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionItems.length === 0 ? (
                <p style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>
                  No action items in your Google Doc
                </p>
              ) : (
                actionItems.map((item) => (
                  <div key={item.id} style={{ 
                    background: COLORS.bgLight,
                    padding: '14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: COLORS.text, fontSize: '14px' }}>{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Document Links */}
        {documentLinks.length > 0 && (
          <div style={{ 
            background: COLORS.bgCard,
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <ExternalLink size={24} color={COLORS.primary} />
              <h2 style={{ 
                color: COLORS.text, 
                fontSize: '20px', 
                margin: 0,
                fontWeight: '600'
              }}>
                Document Links
              </h2>
              <span style={{ 
                background: COLORS.primary + '20',
                color: COLORS.primary,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {documentLinks.length}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {documentLinks.map((link) => (
                <a 
                  key={link.id}
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
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
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = COLORS.secondary + '20';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = COLORS.bgLight;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <ExternalLink size={16} />
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </div>
  );
}
