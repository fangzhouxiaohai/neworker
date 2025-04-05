import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, DatePicker, TimePicker, message, Tag, Tooltip } from 'antd';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const DouyinPublishingQueue = () => {
  const [publishQueue, setPublishQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [publishModal, setPublishModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [publishForm] = Form.useForm();
  const [devices, setDevices] = useState([]);
  const [videos, setVideos] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  useEffect(() => {
    loadPublishQueue();
    loadDevices();
    loadVideos();
    loadAccounts();
    
    const interval = setInterval(() => {
      checkScheduledPublishes();
    }, 60000); // Check every minute
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  const loadPublishQueue = async () => {
    setLoading(true);
    try {
      const queue = getMockPublishQueue();
      setPublishQueue(queue);
    } catch (error) {
      message.error(`Failed to load publish queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const loadDevices = async () => {
    try {
      const deviceList = await window.api.device.getAll();
      setDevices(deviceList.filter(device => device.status === 'online'));
    } catch (error) {
      message.error(`Failed to load devices: ${error.message}`);
    }
  };
  
  const loadVideos = async () => {
    try {
      const videoList = getMockVideos();
      setVideos(videoList);
    } catch (error) {
      message.error(`Failed to load videos: ${error.message}`);
    }
  };
  
  const loadAccounts = async () => {
    try {
      const accountList = getMockAccounts();
      setAccounts(accountList);
    } catch (error) {
      message.error(`Failed to load accounts: ${error.message}`);
    }
  };
  
  const checkScheduledPublishes = () => {
    const now = new Date();
    
    publishQueue.forEach(item => {
      if (item.status === 'scheduled' && new Date(item.scheduledTime) <= now) {
        startPublishing(item.id);
      }
    });
  };
  
  const startPublishing = async (itemId) => {
    try {
      const item = publishQueue.find(i => i.id === itemId);
      if (!item) return;
      
      updateItemStatus(itemId, 'publishing');
      
      
      setTimeout(() => {
        if (Math.random() < 0.9) {
          updateItemStatus(itemId, 'published');
          message.success(`Published video to Douyin: ${item.videoTitle}`);
        } else {
          updateItemStatus(itemId, 'failed');
          message.error(`Failed to publish video: ${item.videoTitle}`);
        }
      }, 5000);
    } catch (error) {
      updateItemStatus(itemId, 'failed');
      message.error(`Publishing error: ${error.message}`);
    }
  };
  
  const updateItemStatus = (itemId, status) => {
    setPublishQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, status };
      }
      return item;
    }));
  };
  
  const addToPublishQueue = (values) => {
    const { 
      videoId, 
      deviceId, 
      accountId, 
      caption, 
      hashtags, 
      scheduleDate, 
      scheduleTime 
    } = values;
    
    const video = videos.find(v => v.id === videoId);
    const account = accounts.find(a => a.id === accountId);
    
    if (!video || !account) {
      message.error('Invalid video or account selection');
      return;
    }
    
    let scheduledTime = null;
    if (scheduleDate && scheduleTime) {
      const date = scheduleDate.toDate();
      const time = scheduleTime.toDate();
      
      date.setHours(time.getHours());
      date.setMinutes(time.getMinutes());
      date.setSeconds(0);
      
      scheduledTime = date;
    }
    
    const newItem = {
      id: `pub_${Date.now()}`,
      videoId,
      videoTitle: video.title,
      videoPath: video.path,
      deviceId,
      accountId,
      accountName: account.username,
      caption,
      hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()) : [],
      scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
      status: scheduledTime ? 'scheduled' : 'pending',
      createdAt: new Date().toISOString()
    };
    
    setPublishQueue(prev => [...prev, newItem]);
    
    setPublishModal(false);
    publishForm.resetFields();
    
    message.success(`Added to publish queue: ${video.title}`);
    
    if (!scheduledTime) {
      startPublishing(newItem.id);
    }
  };
  
  const editPublishQueueItem = (values) => {
    if (!editingItem) return;
    
    const { 
      caption, 
      hashtags, 
      scheduleDate, 
      scheduleTime 
    } = values;
    
    let scheduledTime = null;
    if (scheduleDate && scheduleTime) {
      const date = scheduleDate.toDate();
      const time = scheduleTime.toDate();
      
      date.setHours(time.getHours());
      date.setMinutes(time.getMinutes());
      date.setSeconds(0);
      
      scheduledTime = date;
    }
    
    setPublishQueue(prev => prev.map(item => {
      if (item.id === editingItem.id) {
        return {
          ...item,
          caption,
          hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()) : [],
          scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
          status: scheduledTime ? 'scheduled' : 'pending'
        };
      }
      return item;
    }));
    
    setPublishModal(false);
    setEditingItem(null);
    publishForm.resetFields();
    
    message.success('Updated publish queue item');
    
    if (!scheduledTime && editingItem.status === 'scheduled') {
      const updatedItem = publishQueue.find(item => item.id === editingItem.id);
      startPublishing(updatedItem.id);
    }
  };
  
  const removeFromPublishQueue = (itemId) => {
    setPublishQueue(prev => prev.filter(item => item.id !== itemId));
    message.success('Removed from publish queue');
  };
  
  const getStatusTag = (status) => {
    switch (status) {
      case 'pending':
        return <Tag color="blue">Pending</Tag>;
      case 'scheduled':
        return <Tag color="purple">Scheduled</Tag>;
      case 'publishing':
        return <Tag color="processing">Publishing</Tag>;
      case 'published':
        return <Tag color="success">Published</Tag>;
      case 'failed':
        return <Tag color="error">Failed</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };
  
  const formatScheduledTime = (isoString) => {
    if (!isoString) return 'Immediate';
    
    const date = new Date(isoString);
    return moment(date).format('YYYY-MM-DD HH:mm');
  };
  
  const columns = [
    {
      title: 'Video',
      dataIndex: 'videoTitle',
      key: 'videoTitle'
    },
    {
      title: 'Account',
      dataIndex: 'accountName',
      key: 'accountName'
    },
    {
      title: 'Scheduled Time',
      key: 'scheduledTime',
      render: (_, record) => formatScheduledTime(record.scheduledTime)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {(record.status === 'pending' || record.status === 'scheduled') && (
            <>
              <Button 
                icon={<EditOutlined />} 
                onClick={() => {
                  setEditingItem(record);
                  publishForm.setFieldsValue({
                    caption: record.caption,
                    hashtags: record.hashtags ? record.hashtags.join(', ') : '',
                    scheduleDate: record.scheduledTime ? moment(record.scheduledTime) : null,
                    scheduleTime: record.scheduledTime ? moment(record.scheduledTime) : null
                  });
                  setPublishModal(true);
                }}
              />
              
              <Button 
                icon={<DeleteOutlined />} 
                danger
                onClick={() => removeFromPublishQueue(record.id)}
              />
            </>
          )}
          
          {record.status === 'scheduled' && (
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={() => startPublishing(record.id)}
            />
          )}
          
          {record.status === 'failed' && (
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={() => startPublishing(record.id)}
            />
          )}
        </Space>
      )
    }
  ];
  
  const rowSelection = {
    selectedRowKeys: selectedItems,
    onChange: (selectedRowKeys) => {
      setSelectedItems(selectedRowKeys);
    }
  };
  
  const getMockPublishQueue = () => {
    return [
      {
        id: 'pub_1',
        videoId: 'video_1',
        videoTitle: 'Summer Fun',
        videoPath: '/path/to/video1.mp4',
        deviceId: 'device_1',
        accountId: 'account_1',
        accountName: '@summer_vibes',
        caption: 'Enjoying summer days! #summer #fun',
        hashtags: ['summer', 'fun'],
        scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        status: 'scheduled',
        createdAt: new Date().toISOString()
      },
      {
        id: 'pub_2',
        videoId: 'video_2',
        videoTitle: 'Cooking Tips',
        videoPath: '/path/to/video2.mp4',
        deviceId: 'device_2',
        accountId: 'account_2',
        accountName: '@chef_tips',
        caption: 'Quick cooking tips for beginners',
        hashtags: ['cooking', 'tips', 'food'],
        scheduledTime: null,
        status: 'publishing',
        createdAt: new Date().toISOString()
      },
      {
        id: 'pub_3',
        videoId: 'video_3',
        videoTitle: 'Travel Vlog',
        videoPath: '/path/to/video3.mp4',
        deviceId: 'device_1',
        accountId: 'account_3',
        accountName: '@travel_with_me',
        caption: 'Exploring hidden gems in the city',
        hashtags: ['travel', 'city', 'explore'],
        scheduledTime: null,
        status: 'published',
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
  };
  
  const getMockVideos = () => {
    return [
      {
        id: 'video_1',
        title: 'Summer Fun',
        path: '/path/to/video1.mp4',
        duration: 45,
        status: 'ready'
      },
      {
        id: 'video_2',
        title: 'Cooking Tips',
        path: '/path/to/video2.mp4',
        duration: 83,
        status: 'ready'
      },
      {
        id: 'video_3',
        title: 'Travel Vlog',
        path: '/path/to/video3.mp4',
        duration: 135,
        status: 'ready'
      },
      {
        id: 'video_4',
        title: 'Gaming Stream',
        path: '/path/to/video4.mp4',
        duration: 222,
        status: 'ready'
      }
    ];
  };
  
  const getMockAccounts = () => {
    return [
      {
        id: 'account_1',
        username: '@summer_vibes',
        followers: 5200,
        status: 'active'
      },
      {
        id: 'account_2',
        username: '@chef_tips',
        followers: 12500,
        status: 'active'
      },
      {
        id: 'account_3',
        username: '@travel_with_me',
        followers: 8700,
        status: 'active'
      }
    ];
  };
  
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<UploadOutlined />} 
          onClick={() => {
            setEditingItem(null);
            publishForm.resetFields();
            setPublishModal(true);
          }}
          style={{ marginRight: 8 }}
        >
          Add to Queue
        </Button>
        
        <span style={{ marginLeft: 16 }}>
          {selectedItems.length > 0 ? `Selected ${selectedItems.length} items` : ''}
        </span>
      </div>
      
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={publishQueue} 
        rowKey="id" 
        loading={loading}
      />
      
      <Modal
        title={editingItem ? 'Edit Publishing Task' : 'New Publishing Task'}
        visible={publishModal}
        onCancel={() => {
          setPublishModal(false);
          setEditingItem(null);
          publishForm.resetFields();
        }}
        footer={null}
      >
        <Form 
          form={publishForm} 
          onFinish={editingItem ? editPublishQueueItem : addToPublishQueue}
          layout="vertical"
        >
          {!editingItem && (
            <>
              <Form.Item
                name="videoId"
                label="Video"
                rules={[{ required: true, message: 'Please select a video' }]}
              >
                <Select placeholder="Select video">
                  {videos.map(video => (
                    <Option key={video.id} value={video.id}>
                      {video.title} ({Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item
                name="deviceId"
                label="Device"
                rules={[{ required: true, message: 'Please select a device' }]}
              >
                <Select placeholder="Select device">
                  {devices.map(device => (
                    <Option key={device.id} value={device.id}>
                      {device.id}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item
                name="accountId"
                label="Account"
                rules={[{ required: true, message: 'Please select an account' }]}
              >
                <Select placeholder="Select account">
                  {accounts.map(account => (
                    <Option key={account.id} value={account.id}>
                      {account.username} ({account.followers.toLocaleString()} followers)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          
          <Form.Item
            name="caption"
            label="Caption"
            rules={[{ required: true, message: 'Please enter a caption' }]}
          >
            <TextArea rows={4} placeholder="Enter caption for the video" />
          </Form.Item>
          
          <Form.Item
            name="hashtags"
            label="Hashtags"
          >
            <Input placeholder="Enter hashtags separated by commas" />
          </Form.Item>
          
          <Form.Item label="Schedule (Optional)">
            <Space>
              <Form.Item
                name="scheduleDate"
                noStyle
              >
                <DatePicker placeholder="Select date" />
              </Form.Item>
              
              <Form.Item
                name="scheduleTime"
                noStyle
              >
                <TimePicker format="HH:mm" placeholder="Select time" />
              </Form.Item>
            </Space>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {editingItem ? 'Update' : 'Add to Queue'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DouyinPublishingQueue;
