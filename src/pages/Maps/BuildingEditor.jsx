/**
 * BuildingEditor Component
 * Manages building data editing including names, descriptions, zones, and navigation node assignments.
 * Prevents node conflicts and provides real-time validation.
 */

import { useState, useEffect } from 'react';
import { getAllBuildings, getBuildingById } from '../../config/buildingMappings';

const API_BASE_URL = 'http://localhost:3001/api/map';

export default function BuildingEditor({ onClose, onBuildingUpdated }) {
  // State: Building list and selection
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [buildingData, setBuildingData] = useState(null);
  
  // State: UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nodeAvailability, setNodeAvailability] = useState(null);

  // State: Form fields (controlled inputs)
  const [buildingName, setBuildingName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [zoneId, setZoneId] = useState('');

  // Load all buildings on mount
  useEffect(() => {
    loadBuildings();
  }, []);

  // Fetch all buildings for dropdown
  const loadBuildings = async () => {
    try {
      setLoading(true);
      const data = await getAllBuildings();
      setBuildings(data.sort((a, b) => a.building_name.localeCompare(b.building_name)));
    } catch (err) {
      setError('Failed to load buildings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load selected building details
  const loadBuildingDetails = async (buildingId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const building = await getBuildingById(parseInt(buildingId));
      
      if (building) {
        setBuildingData(building);
        setBuildingName(building.building_name || '');
        setDescription(building.description || '');
        setNodeId(building.node_id !== null ? String(building.node_id) : '');
        setZoneId(String(building.zone_ID || ''));
      }
    } catch (err) {
      setError('Failed to load building details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Check if node is already assigned to another building
  const checkNodeAvailability = async (node) => {
    if (!node || node.trim() === '') {
      setNodeAvailability(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/buildings/node/${node}/check`);
      const data = await response.json();
      setNodeAvailability(data);
    } catch (err) {
      console.error('Failed to check node availability:', err);
      setNodeAvailability(null);
    }
  };

  // Handle building selection from dropdown
  const handleBuildingSelect = (e) => {
    const buildingId = e.target.value;
    setSelectedBuildingId(buildingId);
    
    if (buildingId) {
      loadBuildingDetails(buildingId);
    } else {
      // Clear form
      setBuildingData(null);
      setBuildingName('');
      setDescription('');
      setNodeId('');
      setZoneId('');
      setNodeAvailability(null);
    }
  };

  // Handle node ID input change with validation
  const handleNodeIdChange = (e) => {
    const value = e.target.value;
    setNodeId(value);
    
    // Only check if value changed from current
    if (value && value !== String(buildingData?.node_id)) {
      checkNodeAvailability(value);
    } else {
      setNodeAvailability(null);
    }
  };

  // Remove node assignment
  const handleUnassignNode = () => {
    setNodeId('');
    setNodeAvailability(null);
  };

  // Save changes to database
  const handleSave = async () => {
    // Validation
    if (!selectedBuildingId) {
      setError('Please select a building');
      return;
    }

    if (!buildingName.trim()) {
      setError('Building name is required');
      return;
    }

    if (nodeId && nodeAvailability && !nodeAvailability.available) {
      setError(`Node ${nodeId} is already assigned to another building`);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Prepare update payload
      const updates = {
        building_name: buildingName.trim(),
        description: description.trim(),
        node_id: nodeId.trim() === '' ? null : parseInt(nodeId),
        zone_id: zoneId ? parseInt(zoneId) : buildingData.zone_ID
      };

      console.log('Sending updates:', updates);

      // Send PUT request
      const response = await fetch(`${API_BASE_URL}/buildings/${selectedBuildingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      console.log('Response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update building');
      }

      // Success feedback
      alert(`✅ Building "${data.building_name}" updated successfully!`);
      setSuccess('Building updated successfully!');
      
      // Update local state with server response
      setBuildingData(data);
      setBuildingName(data.building_name || '');
      setDescription(data.description || '');
      setNodeId(data.node_id !== null ? String(data.node_id) : '');
      setZoneId(String(data.zone_ID || ''));
      setNodeAvailability(null);
      
      // Refresh building list
      await loadBuildings();
      
      // Notify parent
      if (onBuildingUpdated) {
        onBuildingUpdated(data);
      }

      // Auto-clear success message
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(err.message || 'Failed to save changes');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
  
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>

      <div style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        maxWidth: 600,
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          {/* Modal title with emoji for visual appeal */}
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            🏢 Building Editor
          </h2>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

    
        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 14
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: '#efe',
            color: '#3c3',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 14
          }}>
            ✅ {success}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            marginBottom: 8,
            fontWeight: 600,
            fontSize: 14
          }}>
            Select Building
          </label>
          <select
            value={selectedBuildingId}
            onChange={handleBuildingSelect}
            disabled={loading}
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '2px solid #ddd',
              borderRadius: 6,
              backgroundColor: loading ? '#f5f5f5' : 'white'
            }}
          >
            <option value="">-- Choose a building --</option>
            {buildings.map(b => (
              <option key={b.building_ID} value={b.building_ID}>
                {b.building_name} (ID: {b.building_ID}, SVG: {b.svg_id})
              </option>
            ))}
          </select>
        </div>

        
        {buildingData && (
          <>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 14
              }}>
                Building Name *
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 14,
                  border: '2px solid #ddd',
                  borderRadius: 6
                }}
                placeholder="Enter building name"
              />
            </div>

           
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 14
              }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 14,
                  border: '2px solid #ddd',
                  borderRadius: 6,
                  resize: 'vertical'
                }}
                placeholder="Enter building description"
              />
            </div>

            
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 14
              }}>
                Zone ID
              </label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 14,
                  border: '2px solid #ddd',
                  borderRadius: 6
                }}
              >
                <option value="1">Zone 1</option>
                <option value="2">Zone 2</option>
                <option value="3">Zone 3</option>
                <option value="4">Zone 4</option>
                <option value="5">Zone 5</option>
                <option value="6">Zone 6</option>
                <option value="7">Zone 7</option>
              </select>
            </div>

           
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 14
              }}>
                Navigation Node ID
              </label>
              
              
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={nodeId}
                  onChange={handleNodeIdChange}
                  style={{
                    flex: 1,
                    padding: 10,
                    fontSize: 14,
                    border: `2px solid ${
                      nodeAvailability?.available === false ? '#f44' : '#ddd'
                    }`,
                    borderRadius: 6
                  }}
                  placeholder="Enter node ID (leave empty for none)"
                />
                {buildingData.node_id !== null && (
                  <button
                    onClick={handleUnassignNode}
                    style={{
                      padding: '10px 16px',
                      fontSize: 14,
                      backgroundColor: '#f44',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    Unassign
                  </button>
                )}
              </div>

              
              {nodeAvailability && (
                <div style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 13,
                  backgroundColor: nodeAvailability.available ? '#efe' : '#fee',
                  color: nodeAvailability.available ? '#3c3' : '#c33'
                }}>
                  {nodeAvailability.available ? (
                    <>✅ Node {nodeId} is available</>
                  ) : (
                    <>
                      ❌ Node {nodeId} is assigned to "{nodeAvailability.assignedTo.building_name}"
                      (ID: {nodeAvailability.assignedTo.building_ID})
                    </>
                  )}
                </div>
              )}

              
              <div style={{
                marginTop: 8,
                fontSize: 13,
                color: '#666'
              }}>
                💡 Assign a navigation node to enable routing to this building
              </div>
            </div>

            
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: 12,
              borderRadius: 6,
              marginBottom: 20,
              fontSize: 13
            }}>
              <div><strong>Building ID:</strong> {buildingData.building_ID}</div>
              <div><strong>SVG ID:</strong> {buildingData.svg_id}</div>
              <div><strong>Current Node:</strong> {buildingData.node_id !== null ? buildingData.node_id : 'Not assigned'}</div>
              <div><strong>Zone:</strong> {buildingData.zone_ID}</div>
            </div>

           
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  backgroundColor: '#ddd',
                  color: '#333',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              
              
              <button
                onClick={handleSave}
                disabled={saving || (nodeAvailability && !nodeAvailability.available)}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  backgroundColor: saving || (nodeAvailability && !nodeAvailability.available) 
                    ? '#ccc' 
                    : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving || (nodeAvailability && !nodeAvailability.available) 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontWeight: 600
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}

        
        {loading && !buildingData && (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
