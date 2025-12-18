import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, formatToken } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import QuestionMessage from '../components/QuestionMessage';

export default function ChatDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { userId, questionId, userName, avatar } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
    loadMessages();
    // 设置导航标题
    if (navigation) {
      navigation.setOptions({
        title: userName || '聊天',
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
      });
    }
  }, [userId, questionId]);

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('提示', '请先登录');
        navigation.goBack();
        return;
      }

      // 获取当前用户ID（如果还没有设置）
      let userIdToCompare = currentUserId;
      if (!userIdToCompare) {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          userIdToCompare = user.id;
          setCurrentUserId(user.id);
        }
      }

      // 加载聊天消息
      // 确保 token 格式正确（后端期望 token-{userId} 格式）
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录');
        navigation.goBack();
        return;
      }
      const messagesUrl = `${API_BASE_URL}/messages/user/${userId}`;
      const messagesResp = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${actualToken}`,
        },
      });

      let chatMessages = [];
      let pendingQuestionFromResponse = null;
      if (messagesResp.ok) {
        const messagesData = await messagesResp.json();
        chatMessages = Array.isArray(messagesData.messages) 
          ? messagesData.messages.map(msg => {
              const msgSenderId = msg.senderId?._id || msg.senderId || msg.fromUserId;
              return {
                id: msg.id || msg._id,
                type: msg.type || 'text',
                content: msg.content,
                senderId: msgSenderId,
                receiverId: msg.receiverId?._id || msg.receiverId,
                timestamp: msg.createdAt || msg.timestamp,
                isMe: msgSenderId?.toString() === userIdToCompare?.toString(),
              };
            })
          : [];
        // 检查是否有未完成的付费提问
        if (messagesData.pendingQuestion) {
          pendingQuestionFromResponse = messagesData.pendingQuestion;
        }
      }

      // 加载付费提问（如果有）
      let questionMessages = [];
      if (questionId) {
        const actualToken = formatToken(token);
        const questionUrl = `${API_BASE_URL}/questions/${questionId}`;
        const questionResp = await fetch(questionUrl, {
          headers: {
            'Authorization': `Bearer ${actualToken}`,
          },
        });
        if (questionResp.ok) {
          const questionData = await questionResp.json();
          questionMessages = [{
            id: `question-${questionId}`,
            type: 'question',
            question: questionData,
          }];
        }
      } else {
        // 加载该用户的所有付费提问
        const actualToken = formatToken(token);
        const questionsUrl = `${API_BASE_URL}/questions/conversation/${userId}`;
        const questionsResp = await fetch(questionsUrl, {
          headers: {
            'Authorization': `Bearer ${actualToken}`,
          },
        });
        if (questionsResp.ok) {
          const questionsData = await questionsResp.json();
          questionMessages = Array.isArray(questionsData.questions)
            ? questionsData.questions.map(q => ({
                id: `question-${q.id || q._id}`,
                type: 'question',
                question: q,
              }))
            : [];
        }
      }

      // 如果有未完成的付费提问，也加入消息列表
      if (pendingQuestionFromResponse && !questionId) {
        const pendingQ = pendingQuestionFromResponse;
        questionMessages.push({
          id: `question-${pendingQ.id || pendingQ._id}`,
          type: 'question',
          question: pendingQ,
        });
      }

      // 合并消息并按时间排序
      const allMessages = [...chatMessages, ...questionMessages].sort((a, b) => {
        const timeA = a.timestamp || a.question?.createdAt || 0;
        const timeB = b.timestamp || b.question?.createdAt || 0;
        return new Date(timeA) - new Date(timeB);
      });

      setMessages(allMessages);
    } catch (error) {
      console.error('加载消息失败:', error);
      Alert.alert('错误', '加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('提示', '请先登录');
        return;
      }

      // 确保 token 格式正确
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${actualToken}`,
        },
        body: JSON.stringify({
          receiverId: userId,
          content: inputText.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setInputText('');
        // 重新加载消息
        await loadMessages();
        // 滚动到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('错误', data.message || '发送失败');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      Alert.alert('错误', '发送消息失败');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    if (item.type === 'question') {
      return (
      <QuestionMessage
        question={item.question}
        currentUserId={currentUserId}
        onUpdate={loadMessages}
      />
      );
    }

    // 普通文本消息
    const isMe = item.isMe;
    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.messageRight : styles.messageLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isMe ? theme.colors.primary : theme.colors.inputBackground,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isMe ? '#fff' : theme.colors.text },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: isMe ? 'rgba(255,255,255,0.7)' : theme.colors.secondaryText },
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyEmoji, { color: theme.colors.secondaryText }]}>💬</Text>
          <Text style={[styles.emptyText, { color: theme.colors.text }]}>还没有消息</Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.secondaryText }]}>
            开始和 {userName || '对方'} 聊天吧
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder="输入消息..."
          placeholderTextColor={theme.colors.placeholder}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>发送</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 15,
    paddingHorizontal: 0,
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    paddingHorizontal: 15,
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

