import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import * as Notifications from 'expo-notifications';
import { API_BASE_URL, formatToken } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import QuestionMessage from '../components/QuestionMessage';
import { handleApiError } from '../utils/errorHandler';

export default function ChatDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { userId, questionId, userName, avatar } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const flatListRef = useRef(null);
  const lastNotifiedMessageIdRef = useRef({});
  const initialLoadDoneRef = useRef({});

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

  // 消息轮询：每10秒自动刷新消息（静默刷新，不显示 loading 避免闪烁）
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const pollInterval = setInterval(() => {
      if (isMounted && navigation) {
        loadMessages(true);
      }
    }, 10000); // 10秒轮询一次

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
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

  const loadMessages = async (isBackgroundRefresh = false) => {
    // 检查组件是否已卸载
    if (!navigation) return;
    // 仅首次加载显示 loading，轮询刷新时不闪屏
    if (!isBackgroundRefresh) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (navigation) {
          Alert.alert('提示', '请先登录');
          navigation.goBack();
        }
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
        if (navigation) {
          Alert.alert('提示', '请先登录');
          navigation.goBack();
        }
        return;
      }
      const messagesUrl = `${API_BASE_URL}/messages/user/${userId}`;
      const messagesResp = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${actualToken}`,
        },
      });

      // 处理 401 错误
      if (messagesResp.status === 401) {
        if (navigation) {
          await handleApiError(messagesResp, navigation);
        }
        return;
      }

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
        if (questionResp.status === 401) {
          if (navigation) {
            await handleApiError(questionResp, navigation);
          }
          return;
        }
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
        if (questionsResp.status === 401) {
          if (navigation) {
            await handleApiError(questionsResp, navigation);
          }
          return;
        }
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

      const lastIncoming = chatMessages.filter((m) => !m.isMe).pop();
      if (lastIncoming && userId) {
        const lastNotifiedId = lastNotifiedMessageIdRef.current[userId];
        const isFirstLoad = !initialLoadDoneRef.current[userId];
        if (isFirstLoad) {
          initialLoadDoneRef.current[userId] = true;
          lastNotifiedMessageIdRef.current[userId] = lastIncoming.id;
        } else if (lastIncoming.id !== lastNotifiedId) {
          const userData = await AsyncStorage.getItem('user');
          const user = userData ? JSON.parse(userData) : {};
          if (user.notificationPreference === 'notification') {
            try {
              await Notifications.presentNotificationAsync({
                content: {
                  title: `${userName || '对方'} 发来新消息`,
                  body: (lastIncoming.content || '').slice(0, 60) + ((lastIncoming.content || '').length > 60 ? '…' : ''),
                  data: { userId, userName, avatar },
                },
              });
              lastNotifiedMessageIdRef.current[userId] = lastIncoming.id;
            } catch (e) {
              console.warn('本地通知失败', e);
            }
          }
        }
      }

      setMessages(allMessages);
    } catch (error) {
      console.error('加载消息失败:', error);
      // 使用统一的错误处理
      if (navigation) {
        await handleApiError(error, navigation);
      }
      // 如果错误已处理（如 401），不需要额外提示
      if (!error.message.includes('未授权')) {
        // handleApiError 已经显示了错误提示
      }
    } finally {
      if (navigation) {
        setLoading(false);
      }
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

      // 处理 401 错误
      if (response.status === 401) {
        if (navigation) {
          await handleApiError(response, navigation);
        }
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setInputText('');
        // 重新加载消息（静默刷新，避免闪屏）
        await loadMessages(true);
        // 滚动到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('错误', data.message || '发送失败');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      if (navigation) {
        await handleApiError(error, navigation);
      }
    } finally {
      setSending(false);
    }
  };

  const renderMessage = useCallback(({ item }) => {
    if (item.type === 'question') {
      return (
        <QuestionMessage
          question={item.question}
          currentUserId={currentUserId}
          onUpdate={() => loadMessages(true)}
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
  }, [theme, currentUserId]);

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

