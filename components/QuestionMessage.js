import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, formatToken } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

export default function QuestionMessage({ question, currentUserId, onUpdate }) {
  const { theme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionState, setQuestionState] = useState(question);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const userId = currentUser?.id || currentUserId;
  // 后端使用 askerId/answererId，可能是 ObjectId 或 populated 对象
  const askerId = questionState.askerId?._id || questionState.askerId || questionState.fromUserId;
  const answererId = questionState.answererId?._id || questionState.answererId || questionState.toUserId;
  const isAsker = askerId === userId || questionState.fromUserId === userId;
  const isAnswerer = answererId === userId || questionState.toUserId === userId;
  const status = questionState.status || 'pending';

  // 计算24小时倒计时
  const getTimeRemaining = () => {
    if (status !== 'accepted') return null;
    const acceptedAt = new Date(questionState.acceptedAt || questionState.createdAt);
    const now = new Date();
    const elapsed = now - acceptedAt;
    const remaining = 24 * 60 * 60 * 1000 - elapsed; // 24小时

    if (remaining <= 0) return null;

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
  };

  const timeRemaining = getTimeRemaining();

  const handleAccept = async () => {
    Alert.alert('确认接受', `确定要接受这个付费提问吗？报酬：¥${questionState.price}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '接受',
        onPress: async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
              Alert.alert('提示', '请先登录');
              return;
            }
            const actualToken = formatToken(token);
            if (!actualToken) {
              Alert.alert('提示', '请先登录');
              return;
            }
            const response = await fetch(`${API_BASE_URL}/questions/${questionState.id || questionState._id}/accept`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${actualToken}`,
                'Content-Type': 'application/json',
              },
            });

            const data = await response.json();
            if (response.ok) {
              setQuestionState({ ...questionState, status: 'accepted', acceptedAt: new Date().toISOString() });
              if (onUpdate) onUpdate();
            } else {
              Alert.alert('错误', data.message || '接受失败');
            }
          } catch (error) {
            console.error('接受提问失败:', error);
            Alert.alert('错误', '接受提问失败');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    Alert.alert('确认拒绝', '确定要拒绝这个付费提问吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '拒绝',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
              Alert.alert('提示', '请先登录');
              return;
            }
            const actualToken = formatToken(token);
            if (!actualToken) {
              Alert.alert('提示', '请先登录');
              return;
            }
            const response = await fetch(`${API_BASE_URL}/questions/${questionState.id || questionState._id}/reject`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${actualToken}`,
                'Content-Type': 'application/json',
              },
            });

            const data = await response.json();
            if (response.ok) {
              setQuestionState({ ...questionState, status: 'rejected' });
              if (onUpdate) onUpdate();
            } else {
              Alert.alert('错误', data.message || '拒绝失败');
            }
          } catch (error) {
            console.error('拒绝提问失败:', error);
            Alert.alert('错误', '拒绝提问失败');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      Alert.alert('提示', '请输入回答内容');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('提示', '请先登录');
        return;
      }
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/questions/${questionState.id || questionState._id}/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${actualToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: answerText.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setQuestionState({ ...questionState, status: 'answered', answer: answerText.trim() });
        setAnswerText('');
        if (onUpdate) onUpdate();
        Alert.alert('成功', '回答已提交，24小时后将自动放款');
      } else {
        Alert.alert('错误', data.message || '提交回答失败');
      }
    } catch (error) {
      console.error('提交回答失败:', error);
      Alert.alert('错误', '提交回答失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '待接受';
      case 'accepted':
        return '已接受';
      case 'answered':
        return '已回答';
      case 'completed':
      case 'paid':
        return '已放款';
      case 'rejected':
        return '已拒绝';
      case 'disputed':
      case 'appealed':
        return '申诉中';
      case 'refunded':
        return '已退款';
      default:
        return '未知状态';
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>💰 付费提问</Text>
        <Text style={[styles.price, { color: theme.colors.primary }]}>¥{questionState.price}</Text>
      </View>

      <View style={[styles.questionBox, { backgroundColor: theme.colors.inputBackground }]}>
        <Text style={[styles.questionText, { color: theme.colors.text }]}>
          {questionState.content}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: theme.colors.secondaryText }]}>
          状态: {getStatusText()}
        </Text>
        {timeRemaining && (
          <Text style={[styles.timerText, { color: theme.colors.primary }]}>
            {timeRemaining.hours}小时{timeRemaining.minutes}分钟后自动放款
          </Text>
        )}
      </View>

      {status === 'answered' && questionState.answer && (
        <View style={[styles.answerBox, { backgroundColor: theme.colors.inputBackground }]}>
          <Text style={[styles.answerLabel, { color: theme.colors.secondaryText }]}>回答：</Text>
          <Text style={[styles.answerText, { color: theme.colors.text }]}>
            {typeof questionState.answer === 'string' 
              ? questionState.answer 
              : questionState.answer.content || ''}
          </Text>
        </View>
      )}

      {isAnswerer && status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton, { borderColor: theme.colors.border }]}
            onPress={handleReject}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>拒绝</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleAccept}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: '#fff' }]}>接受</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isAnswerer && status === 'accepted' && (
        <View style={styles.answerSection}>
          <TextInput
            style={[
              styles.answerInput,
              {
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="请输入您的回答..."
            placeholderTextColor={theme.colors.placeholder}
            value={answerText}
            onChangeText={setAnswerText}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSubmitAnswer}
            disabled={loading || !answerText.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>提交回答</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isAsker && status === 'answered' && (
        <Text style={[styles.hintText, { color: theme.colors.secondaryText }]}>
          回答已提交，24小时后将自动放款给回答者
        </Text>
      )}

      {status === 'paid' && (
        <Text style={[styles.hintText, { color: theme.colors.primary }]}>
          ✓ 已自动放款
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  questionBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  answerBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  answerLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    borderWidth: 1,
  },
  acceptButton: {
    // backgroundColor handled by style prop
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  answerSection: {
    marginTop: 10,
  },
  answerInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});

