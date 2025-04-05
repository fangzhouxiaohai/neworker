import React, { useState, useEffect } from 'react';
import { Table, Button, Progress, Space, Modal, Input, Form, Select, message, Tag, Tooltip } from 'antd';
import { 
  DownloadOutlined, 
  DeleteOutlined, 
  PauseCircleOutlined, 
  PlayCircleOutlined,
  InfoCircleOutlined,
  EditOutlined
} from '@ant-design/icons';

const { Option } = Select;

const VideoDownloadList = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDownloads, setSelectedDownloads] = useState([]);
  const [downloadModal, setDownloadModal] = useState(false);
  const [downloadForm] = Form.useForm();
  
  useEffect(() => {
    loadDownloads();
    
    window.api.on('download:queued', handleDownloadQueued);
    window.api.on('download:started', handleDownloadStarted);
    window.api.on('download:progress', handleDownloadProgress);
    window.api.on('download:completed', handleDownloadCompleted);
    window.api.on('download:error', handleDownloadError);
    window.api.on('download:cancelled', handleDownloadCancelled);
    
    return () => {
      window.api.removeListener('download:queued', handleDownloadQueued);
      window.api.removeListener('download:started', handleDownloadStarted);
      window.api.removeListener('download:progress', handleDownloadProgress);
      window.api.removeListener('download:completed', handleDownloadCompleted);
      window.api.removeListener('download:error', handleDownloadError);
      window.api.removeListener('download:cancelled', handleDownloadCancelled);
    };
  }, []);
  
  const loadDownloads = async () => {
    setLoading(true);
    try {
      const downloadList = await window.api.video.getAllDownloads();
      setDownloads(downloadList);
    } catch (error) {
      message.error(`Failed to load downloads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownloadQueued = (downloadItem) => {
    setDownloads(prev => {
      const exists = prev.some(d => d.id === downloadItem.id);
      if (exists) {
        return prev.map(d => d.id === downloadItem.id ? downloadItem : d);
      } else {
        return [...prev, downloadItem];
      }
    });
  };
  
  const handleDownloadStarted = (downloadItem) => {
    setDownloads(prev => prev.map(d => d.id === downloadItem.id ? downloadItem : d));
  };
  
  const handleDownloadProgress = (progressInfo) => {
    setDownloads(prev => prev.map(d => {
      if (d.id === progressInfo.id) {
        return { ...d, progress: progressInfo.progress };
      }
      return d;
    }));
  };
  
  const handleDownloadCompleted = (downloadItem) => {
    setDownloads(prev => prev.map(d => d.id === downloadItem.id ? downloadItem : d));
    message.success(`Download completed: ${downloadItem.filename}`);
  };
  
  const handleDownloadError = (errorInfo) => {
    setDownloads(prev => prev.map(d => {
      if (d.id === errorInfo.id) {
        return { ...d, status: 'error', error: errorInfo.error };
      }
      return d;
    }));
    message.error(`Download failed: ${errorInfo.error}`);
  };
  
  const handleDownloadCancelled = (downloadItem) => {
    setDownloads(prev => prev.map(d => d.id === downloadItem.id ? downloadItem : d));
    message.info(`Download cancelled: ${downloadItem.filename}`);
  };
  
  const queueDownload = async (values) => {
    const { url, title, tags } = values;
    
    try {
      const downloadId = await window.api.video.queueDownload(url, {
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`,
        title,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });
      
      message.success(`Download queued: ${title}`);
      setDownloadModal(false);
      downloadForm.resetFields();
    } catch (error) {
      message.error(`Failed to queue download: ${error.message}`);
    }
  };
  
  const cancelDownload = async (downloadId) => {
    try {
      const result = await window.api.video.cancelDownload(downloadId);
      if (result) {
        message.success('Download cancelled');
      } else {
        message.warning('Failed to cancel download');
      }
    } catch (error) {
      message.error(`Error cancelling download: ${error.message}`);
    }
  };
  
  const pauseAllDownloads = async () => {
    try {
      await window.api.video.pauseAll();
      message.success('All downloads paused');
    } catch (error) {
      message.error(`Failed to pause downloads: ${error.message}`);
    }
  };
  
  const resumeAllDownloads = async () => {
    try {
      await window.api.video.resumeAll();
      message.success('Downloads resumed');
    } catch (error) {
      message.error(`Failed to resume downloads: ${error.message}`);
    }
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  const getStatusTag = (status) => {
    switch (status) {
      case 'queued':
        return <Tag color="blue">Queued</Tag>;
      case 'downloading':
        return <Tag color="processing">Downloading</Tag>;
      case 'completed':
        return <Tag color="success">Completed</Tag>;
      case 'error':
        return <Tag color="error">Error</Tag>;
      case 'cancelled':
        return <Tag color="default">Cancelled</Tag>;
      case 'paused':
        return <Tag color="warning">Paused</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };
  
  const columns = [
    {
      title: 'Title',
      dataIndex: 'metadata',
      key: 'title',
      render: (metadata) => metadata?.title || 'Untitled'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_, record) => {
        if (record.status === 'completed') {
          return <Progress percent={100} size="small" status="success" />;
        }
        
        if (record.status === 'error') {
          return <Progress percent={record.progress || 0} size="small" status="exception" />;
        }
        
        if (record.status === 'cancelled' || record.status === 'paused') {
          return <Progress percent={record.progress || 0} size="small" status="normal" />;
        }
        
        return <Progress percent={record.progress || 0} size="small" />;
      }
    },
    {
      title: 'Size',
      key: 'size',
      render: (_, record) => {
        if (record.downloadedBytes && record.totalBytes) {
          return `${formatFileSize(record.downloadedBytes)} / ${formatFileSize(record.totalBytes)}`;
        }
        
        if (record.downloadedBytes) {
          return formatFileSize(record.downloadedBytes);
        }
        
        return '--';
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'error' && (
            <Tooltip title={record.error}>
              <Button icon={<InfoCircleOutlined />} />
            </Tooltip>
          )}
          
          {(record.status === 'queued' || record.status === 'downloading') && (
            <Button 
              icon={<DeleteOutlined />} 
              danger
              onClick={() => cancelDownload(record.id)}
            />
          )}
          
          {record.status === 'completed' && (
            <Button 
              icon={<EditOutlined />}
              onClick={() => {
              }}
            />
          )}
        </Space>
      )
    }
  ];
  
  const rowSelection = {
    selectedRowKeys: selectedDownloads,
    onChange: (selectedRowKeys) => {
      setSelectedDownloads(selectedRowKeys);
    }
  };
  
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<DownloadOutlined />} 
          onClick={() => setDownloadModal(true)}
          style={{ marginRight: 8 }}
        >
          New Download
        </Button>
        
        <Button 
          icon={<PauseCircleOutlined />} 
          onClick={pauseAllDownloads}
          style={{ marginRight: 8 }}
        >
          Pause All
        </Button>
        
        <Button 
          icon={<PlayCircleOutlined />} 
          onClick={resumeAllDownloads}
        >
          Resume All
        </Button>
        
        <span style={{ marginLeft: 16 }}>
          {selectedDownloads.length > 0 ? `Selected ${selectedDownloads.length} downloads` : ''}
        </span>
      </div>
      
      <Table 
        rowSelection={rowSelection}
        columns={columns} 
        dataSource={downloads} 
        rowKey="id" 
        loading={loading}
      />
      
      <Modal
        title="New Download"
        visible={downloadModal}
        onCancel={() => setDownloadModal(false)}
        footer={null}
      >
        <Form form={downloadForm} onFinish={queueDownload}>
          <Form.Item
            name="url"
            label="Video URL"
            rules={[{ required: true, message: 'Please enter the video URL' }]}
          >
            <Input placeholder="Enter video URL" />
          </Form.Item>
          
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="Enter video title" />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="Tags"
          >
            <Input placeholder="Enter tags separated by commas" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Download
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VideoDownloadList;
