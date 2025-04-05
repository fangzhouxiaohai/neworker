import React, { useState } from 'react';
import { Layout, Menu, Typography, Badge, notification } from 'antd';
import { 
  MobileOutlined, 
  VideoCameraOutlined, 
  UploadOutlined, 
  SettingOutlined,
  DashboardOutlined,
  TeamOutlined
} from '@ant-design/icons';
import DeviceList from './components/DeviceList';
import VideoDownloadList from './components/VideoDownloadList';
import DouyinPublishingQueue from './components/DouyinPublishingQueue';

const { Header, Sider, Content, Footer } = Layout;
const { Title } = Typography;

const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [publishCount, setPublishCount] = useState(0);
  
  React.useEffect(() => {
    window.api.on('device:connected', (device) => {
      notification.success({
        message: 'Device Connected',
        description: `Device ${device.id} has been connected.`,
        placement: 'bottomRight'
      });
      
      window.api.device.getAll().then(devices => {
        setDeviceCount(devices.filter(d => d.status === 'online').length);
      });
    });
    
    window.api.on('device:disconnected', (device) => {
      notification.warning({
        message: 'Device Disconnected',
        description: `Device ${device.id} has been disconnected.`,
        placement: 'bottomRight'
      });
      
      window.api.device.getAll().then(devices => {
        setDeviceCount(devices.filter(d => d.status === 'online').length);
      });
    });
    
    window.api.on('download:completed', (downloadItem) => {
      notification.success({
        message: 'Download Completed',
        description: `Download completed: ${downloadItem.filename}`,
        placement: 'bottomRight'
      });
      
      window.api.video.getAllDownloads().then(downloads => {
        setDownloadCount(downloads.filter(d => d.status === 'downloading').length);
      });
    });
    
    window.api.on('download:error', (errorInfo) => {
      notification.error({
        message: 'Download Error',
        description: `Download failed: ${errorInfo.error}`,
        placement: 'bottomRight'
      });
    });
    
    window.api.on('upload:success', (uploadInfo) => {
      notification.success({
        message: 'Upload Successful',
        description: `Video uploaded to Douyin from device ${uploadInfo.deviceId}`,
        placement: 'bottomRight'
      });
    });
    
    window.api.on('upload:failed', (uploadInfo) => {
      notification.error({
        message: 'Upload Failed',
        description: `Failed to upload video from device ${uploadInfo.deviceId}`,
        placement: 'bottomRight'
      });
    });
    
    window.api.on('error', (errorInfo) => {
      notification.error({
        message: 'Error',
        description: `${errorInfo.source}: ${errorInfo.error}`,
        placement: 'bottomRight'
      });
    });
    
    window.api.device.getAll().then(devices => {
      setDeviceCount(devices.filter(d => d.status === 'online').length);
    });
    
    window.api.video.getAllDownloads().then(downloads => {
      setDownloadCount(downloads.filter(d => d.status === 'downloading').length);
    });
    
    return () => {
      window.api.removeListener('device:connected');
      window.api.removeListener('device:disconnected');
      window.api.removeListener('download:completed');
      window.api.removeListener('download:error');
      window.api.removeListener('upload:success');
      window.api.removeListener('upload:failed');
      window.api.removeListener('error');
    };
  }, []);
  
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'devices':
        return <DeviceList />;
      case 'videos':
        return <VideoDownloadList />;
      case 'publishing':
        return <DouyinPublishingQueue />;
      case 'accounts':
        return <AccountsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };
  
  const DashboardPage = () => (
    <div>
      <Title level={2}>Dashboard</Title>
      <p>Welcome to the Android Device Control System</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <StatCard 
          title="Connected Devices" 
          value={deviceCount} 
          icon={<MobileOutlined />} 
          color="#1890ff"
        />
        <StatCard 
          title="Active Downloads" 
          value={downloadCount} 
          icon={<VideoCameraOutlined />} 
          color="#52c41a"
        />
        <StatCard 
          title="Pending Uploads" 
          value={publishCount} 
          icon={<UploadOutlined />} 
          color="#faad14"
        />
      </div>
    </div>
  );
  
  const AccountsPage = () => (
    <div>
      <Title level={2}>Accounts Management</Title>
      <p>Manage your Douyin accounts here.</p>
    </div>
  );
  
  const SettingsPage = () => (
    <div>
      <Title level={2}>Settings</Title>
      <p>Configure application settings here.</p>
    </div>
  );
  
  const StatCard = ({ title, value, icon, color }) => (
    <div style={{ 
      background: 'white', 
      padding: '20px', 
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      width: '250px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#8c8c8c' }}>{title}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>{value}</div>
        </div>
        <div style={{ 
          background: `${color}20`, 
          color: color, 
          padding: '12px',
          borderRadius: '50%',
          fontSize: '24px'
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? '16px' : '18px',
          fontWeight: 'bold'
        }}>
          {collapsed ? 'ADCS' : 'Android Control'}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          onClick={({ key }) => setCurrentPage(key)}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: 'Dashboard'
            },
            {
              key: 'devices',
              icon: <MobileOutlined />,
              label: 'Devices',
              children: [
                {
                  key: 'devices',
                  label: 'All Devices'
                },
                {
                  key: 'groups',
                  label: 'Device Groups'
                }
              ]
            },
            {
              key: 'videos',
              icon: <VideoCameraOutlined />,
              label: 'Videos'
            },
            {
              key: 'publishing',
              icon: <UploadOutlined />,
              label: 'Publishing'
            },
            {
              key: 'accounts',
              icon: <TeamOutlined />,
              label: 'Accounts'
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: 'Settings'
            }
          ]}
        />
      </Sider>
      
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {currentPage === 'dashboard' && 'Dashboard'}
              {currentPage === 'devices' && 'Device Management'}
              {currentPage === 'videos' && 'Video Library'}
              {currentPage === 'publishing' && 'Publishing Queue'}
              {currentPage === 'accounts' && 'Account Management'}
              {currentPage === 'settings' && 'Settings'}
            </Title>
          </div>
          
          <div>
            <Badge count={deviceCount} style={{ marginRight: 24 }}>
              <MobileOutlined style={{ fontSize: 18 }} />
            </Badge>
            
            <Badge count={downloadCount} style={{ marginRight: 24 }}>
              <VideoCameraOutlined style={{ fontSize: 18 }} />
            </Badge>
            
            <Badge count={publishCount}>
              <UploadOutlined style={{ fontSize: 18 }} />
            </Badge>
          </div>
        </Header>
        
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          {renderContent()}
        </Content>
        
        <Footer style={{ textAlign: 'center' }}>
          Android Device Control System ©2025
        </Footer>
      </Layout>
    </Layout>
  );
};

export default App;
