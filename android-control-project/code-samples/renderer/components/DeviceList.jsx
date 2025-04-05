import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Progress, Space, Modal, Input, Select, Form, message } from 'antd';
import { ReloadOutlined, SettingOutlined, PlayCircleOutlined, CameraOutlined, PoweroffOutlined } from '@ant-design/icons';

const { Option } = Select;

const DeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [commandModal, setCommandModal] = useState(false);
  const [commandForm] = Form.useForm();
  const [batteryInfo, setBatteryInfo] = useState({});
  const [storageInfo, setStorageInfo] = useState({});
  
  useEffect(() => {
    loadDevices();
    
    window.api.on('device:connected', handleDeviceConnected);
    window.api.on('device:disconnected', handleDeviceDisconnected);
    window.api.on('devices:updated', handleDevicesUpdated);
    
    const interval = setInterval(() => {
      refreshDeviceInfo();
    }, 30000); // Every 30 seconds
    
    return () => {
      window.api.removeListener('device:connected', handleDeviceConnected);
      window.api.removeListener('device:disconnected', handleDeviceDisconnected);
      window.api.removeListener('devices:updated', handleDevicesUpdated);
      clearInterval(interval);
    };
  }, []);
  
  const loadDevices = async () => {
    setLoading(true);
    try {
      const deviceList = await window.api.device.getAll();
      setDevices(deviceList);
      
      deviceList.forEach(device => {
        loadBatteryInfo(device.id);
        loadStorageInfo(device.id);
      });
    } catch (error) {
      message.error(`Failed to load devices: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const refreshDeviceInfo = () => {
    devices.forEach(device => {
      if (device.status === 'online') {
        loadBatteryInfo(device.id);
        loadStorageInfo(device.id);
      }
    });
  };
  
  const loadBatteryInfo = async (deviceId) => {
    try {
      const info = await window.api.device.getBatteryInfo(deviceId);
      setBatteryInfo(prev => ({
        ...prev,
        [deviceId]: info
      }));
    } catch (error) {
      console.error(`Failed to load battery info for ${deviceId}:`, error);
    }
  };
  
  const loadStorageInfo = async (deviceId) => {
    try {
      const info = await window.api.device.getStorageInfo(deviceId);
      setStorageInfo(prev => ({
        ...prev,
        [deviceId]: info
      }));
    } catch (error) {
      console.error(`Failed to load storage info for ${deviceId}:`, error);
    }
  };
  
  const handleDeviceConnected = (device) => {
    setDevices(prev => {
      const exists = prev.some(d => d.id === device.id);
      if (exists) {
        return prev.map(d => d.id === device.id ? device : d);
      } else {
        return [...prev, device];
      }
    });
    
    loadBatteryInfo(device.id);
    loadStorageInfo(device.id);
    message.success(`Device ${device.id} connected`);
  };
  
  const handleDeviceDisconnected = (device) => {
    setDevices(prev => prev.filter(d => d.id !== device.id));
    message.warning(`Device ${device.id} disconnected`);
  };
  
  const handleDevicesUpdated = (deviceList) => {
    setDevices(deviceList);
  };
  
  const takeScreenshot = async (deviceId) => {
    try {
      const screenshotPath = await window.api.device.takeScreenshot(deviceId);
      message.success(`Screenshot saved to ${screenshotPath}`);
    } catch (error) {
      message.error(`Failed to take screenshot: ${error.message}`);
    }
  };
  
  const executeCommand = async (deviceId, command) => {
    try {
      const result = await window.api.device.executeCommand(deviceId, command);
      Modal.info({
        title: 'Command Result',
        content: (
          <div>
            <p>Device: {deviceId}</p>
            <p>Command: {command}</p>
            <pre style={{ maxHeight: '300px', overflow: 'auto' }}>{result}</pre>
          </div>
        ),
        width: 600
      });
    } catch (error) {
      message.error(`Failed to execute command: ${error.message}`);
    }
  };
  
  const executeBatchCommand = async (values) => {
    const { command } = values;
    
    if (!selectedDevices.length) {
      message.warning('Please select at least one device');
      return;
    }
    
    try {
      const results = await window.api.device.executeBatchCommand(selectedDevices, command);
      
      Modal.info({
        title: 'Batch Command Results',
        content: (
          <div>
            <p>Command: {command}</p>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {Array.from(results.entries()).map(([deviceId, result]) => (
                <div key={deviceId} style={{ marginBottom: '10px' }}>
                  <h4>Device: {deviceId}</h4>
                  <pre>{typeof result === 'object' ? JSON.stringify(result, null, 2) : result}</pre>
                </div>
              ))}
            </div>
          </div>
        ),
        width: 700
      });
      
      setCommandModal(false);
      commandForm.resetFields();
    } catch (error) {
      message.error(`Failed to execute batch command: ${error.message}`);
    }
  };
  
  const columns = [
    {
      title: 'Device',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span>{id}</span>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={status === 'online' ? 'success' : 'default'} 
          text={status === 'online' ? 'Online' : 'Offline'} 
        />
      )
    },
    {
      title: 'Battery',
      key: 'battery',
      render: (_, record) => {
        const info = batteryInfo[record.id];
        if (!info || record.status !== 'online') {
          return <span>--</span>;
        }
        
        const level = info.level || info['level'] || 0;
        return (
          <span>
            {level}% 
            {info.status === 'Charging' && <span style={{ marginLeft: 5 }}>⚡</span>}
          </span>
        );
      }
    },
    {
      title: 'Storage',
      key: 'storage',
      render: (_, record) => {
        const info = storageInfo[record.id];
        if (!info || record.status !== 'online') {
          return <span>--</span>;
        }
        
        return (
          <div style={{ width: 150 }}>
            <Progress 
              percent={info.usedPercentage} 
              size="small" 
              status={info.usedPercentage > 90 ? 'exception' : 'normal'}
            />
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<SettingOutlined />} 
            disabled={record.status !== 'online'}
            onClick={() => {
              Modal.confirm({
                title: 'Execute Command',
                content: (
                  <Input.TextArea 
                    rows={4} 
                    placeholder="Enter ADB command"
                    id="command-input"
                  />
                ),
                onOk: () => {
                  const command = document.getElementById('command-input').value;
                  if (command) {
                    executeCommand(record.id, command);
                  }
                }
              });
            }}
          />
          <Button 
            icon={<CameraOutlined />} 
            disabled={record.status !== 'online'}
            onClick={() => takeScreenshot(record.id)}
          />
          <Button 
            icon={<PlayCircleOutlined />} 
            disabled={record.status !== 'online'}
            onClick={() => {
            }}
          />
        </Space>
      )
    }
  ];
  
  const rowSelection = {
    selectedRowKeys: selectedDevices,
    onChange: (selectedRowKeys) => {
      setSelectedDevices(selectedRowKeys);
    }
  };
  
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={loadDevices} 
          loading={loading}
          style={{ marginRight: 8 }}
        >
          Refresh
        </Button>
        
        <Button 
          type="primary" 
          disabled={selectedDevices.length === 0} 
          onClick={() => setCommandModal(true)}
        >
          Batch Actions
        </Button>
        
        <span style={{ marginLeft: 16 }}>
          {selectedDevices.length > 0 ? `Selected ${selectedDevices.length} devices` : ''}
        </span>
      </div>
      
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={devices} 
        rowKey="id" 
        loading={loading}
        pagination={false}
      />
      
      <Modal
        title="Execute Batch Command"
        visible={commandModal}
        onCancel={() => setCommandModal(false)}
        footer={null}
      >
        <Form form={commandForm} onFinish={executeBatchCommand}>
          <Form.Item
            name="command"
            label="ADB Command"
            rules={[{ required: true, message: 'Please enter a command' }]}
          >
            <Input.TextArea rows={4} placeholder="Enter ADB command to execute on all selected devices" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Execute
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceList;
