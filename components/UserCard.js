import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, formatToken } from '../constants/config';

export default function UserCard({ visible, user, onClose, onChat, currentUserId }) {
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionPrice, setQuestionPrice] = useState('');

  if (!user) return null;

  // 模拟标签数据（后续从后端获取）
  const mockTags = user.tags || [
    { id: 1, name: '山东工商学院', type: 'required', level: 2, verified: true },
    { id: 2, name: '计算机科学', type: 'custom', level: 1, verified: false },
    { id: 3, name: '前端开发', type: 'custom', level: 1, verified: false },
  ];

  const handleSendQuestion = async () => {
    if (!questionText.trim()) {
      Alert.alert('提示', '请输入问题内容');
      return;
    }
    if (!questionPrice || parseFloat(questionPrice) <= 0) {
      Alert.alert('提示', '请输入有效的提问价格');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('提示', '请先登录后再提问');
        return;
      }
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录后再提问');
        return;
      }
      const resp = await fetch(`${API_BASE_URL}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${actualToken}`,
        },
        body: JSON.stringify({
          answererId: user.id,
          content: questionText.trim(),
          price: parseFloat(questionPrice),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || '发送失败');
      }
      Alert.alert('成功', `已发送提问，价格：¥${questionPrice}`, [
        { text: '确定', onPress: () => {
          setShowQuestionModal(false);
          setQuestionText('');
          setQuestionPrice('');
        }}
      ]);
    } catch (error) {
      console.error('发送提问失败', error);
      Alert.alert('错误', error.message || '发送提问失败');
    }
  };

  const handleChat = () => {
    if (onChat) {
      onChat(user);
    }
    onClose();
  };

  const getTagStyle = (tag) => {
    if (tag.level === 2) {
      return styles.tagVerified;
    }
    return styles.tagUnverified;
  };

  const getTagIcon = (tag) => {
    if (tag.type === 'required') return '🏢';
    if (tag.type === 'optional') return '📚';
    return '🏷️';
  };

  const getTagTypeName = (tag) => {
    if (tag.type === 'required') return '现在单位';
    if (tag.type === 'optional') return '曾所属单位';
    return '自定义标签';
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.card} onStartShouldSetResponder={() => true}>
            {/* 用户信息头部 */}
            <View style={styles.header}>
              <Image
                source={{ uri: user.avatar }}
                style={styles.avatar}
              />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userId}>ID: {user.id}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 标签区域 */}
            <ScrollView style={styles.tagsContainer}>
              <Text style={styles.sectionTitle}>身份标签</Text>
              <View style={styles.tagsList}>
                {mockTags.map((tag) => (
                  <View key={tag.id} style={[styles.tag, getTagStyle(tag)]}>
                    <View style={[styles.tagLevelBadge, tag.level === 2 ? styles.tagLevelBadge2 : styles.tagLevelBadge1]}>
                      <Text style={styles.tagLevelText}>{tag.level}</Text>
                    </View>
                    <Text style={styles.tagIcon}>{getTagIcon(tag)}</Text>
                    <View style={styles.tagContent}>
                      <Text style={styles.tagText}>{tag.name}</Text>
                      <Text style={styles.tagType}>{getTagTypeName(tag)}</Text>
                    </View>
                    {tag.level === 2 && (
                      <Text style={styles.verifiedBadge}>✓ 已认证</Text>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* 操作按钮 */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.chatButton]}
                onPress={handleChat}
              >
                <Text style={styles.buttonText}>💬 私聊</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.questionButton]}
                onPress={() => setShowQuestionModal(true)}
              >
                <Text style={styles.buttonText}>💰 付费提问</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 提问弹窗 */}
      <Modal
        visible={showQuestionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQuestionModal(false)}
      >
        <View style={styles.questionOverlay}>
          <View style={styles.questionModal}>
            <Text style={styles.questionTitle}>付费提问</Text>
            <Text style={styles.questionSubtitle}>向 {user.name} 提问</Text>

            <Text style={styles.label}>问题内容</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              placeholder="请输入您的问题..."
              value={questionText}
              onChangeText={setQuestionText}
            />

            <Text style={styles.label}>提问价格（元）</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0.00"
              value={questionPrice}
              onChangeText={setQuestionPrice}
            />

            <View style={styles.questionActions}>
              <TouchableOpacity
                style={[styles.questionButton, styles.cancelButton]}
                onPress={() => {
                  setShowQuestionModal(false);
                  setQuestionText('');
                  setQuestionPrice('');
                }}
              >
                <Text style={styles.questionButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.questionButton, styles.submitButton]}
                onPress={handleSendQuestion}
              >
                <Text style={[styles.questionButtonText, styles.submitButtonText]}>
                  发送
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userId: {
    fontSize: 14,
    color: '#999',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: '#999',
  },
  tagsContainer: {
    maxHeight: 300,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    minWidth: 120,
  },
  tagContent: {
    flex: 1,
    marginLeft: 6,
  },
  tagVerified: {
    backgroundColor: '#E6F7FF',
    borderWidth: 1,
    borderColor: '#91D5FF',
  },
  tagUnverified: {
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#FFD591',
  },
  tagLevelBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  tagLevelBadge1: {
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#FFD591',
  },
  tagLevelBadge2: {
    backgroundColor: '#E6F7FF',
    borderWidth: 1,
    borderColor: '#91D5FF',
  },
  tagLevelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  tagIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  tagType: {
    fontSize: 11,
    color: '#999',
  },
  verifiedBadge: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButton: {
    backgroundColor: '#007AFF',
  },
  questionButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 提问弹窗样式
  questionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  questionModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  questionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  questionActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  questionButtonText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    paddingVertical: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

