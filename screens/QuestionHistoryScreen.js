import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, formatToken } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import QuestionMessage from '../components/QuestionMessage';

export default function QuestionHistoryScreen({ navigation, route }) {
  const { theme } = useTheme();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, sent, received
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    loadQuestions();
  }, [filter]);

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

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('提示', '请先登录');
        navigation.goBack();
        return;
      }

      // 确保 token 格式正确
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录');
        navigation.goBack();
        return;
      }

      let questionsList = [];

      if (filter === 'all') {
        // 全部：分别获取我发出的和我收到的，然后合并
        const [sentResp, receivedResp] = await Promise.all([
          fetch(`${API_BASE_URL}/questions/my-asked`, {
            headers: {
              'Authorization': `Bearer ${actualToken}`,
            },
          }),
          fetch(`${API_BASE_URL}/questions/my-received`, {
            headers: {
              'Authorization': `Bearer ${actualToken}`,
            },
          }),
        ]);

        const sentData = sentResp.ok ? await sentResp.json() : { questions: [] };
        const receivedData = receivedResp.ok ? await receivedResp.json() : { questions: [] };
        
        const sentQuestions = Array.isArray(sentData.questions) ? sentData.questions : [];
        const receivedQuestions = Array.isArray(receivedData.questions) ? receivedData.questions : [];
        
        questionsList = [...sentQuestions, ...receivedQuestions];
      } else if (filter === 'sent') {
        // 我发出的
        const response = await fetch(`${API_BASE_URL}/questions/my-asked`, {
          headers: {
            'Authorization': `Bearer ${actualToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          questionsList = Array.isArray(data.questions) ? data.questions : [];
        }
      } else if (filter === 'received') {
        // 我收到的
        const response = await fetch(`${API_BASE_URL}/questions/my-received`, {
          headers: {
            'Authorization': `Bearer ${actualToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          questionsList = Array.isArray(data.questions) ? data.questions : [];
        }
      }

      // 映射后端字段到前端期望的字段格式
      const mappedQuestions = questionsList.map(q => ({
        id: q._id || q.id,
        _id: q._id || q.id,
        // 后端使用 askerId/answererId，前端期望 fromUserId/toUserId
        fromUserId: q.askerId?._id || q.askerId,
        toUserId: q.answererId?._id || q.answererId,
        fromUserName: q.askerId?.username || '用户',
        toUserName: q.answererId?.username || '用户',
        content: q.content,
        price: q.price,
        status: q.status === 'completed' ? 'paid' : q.status, // 后端 completed = 前端 paid
        createdAt: q.createdAt,
        acceptedAt: q.acceptedAt,
        rejectedAt: q.rejectedAt,
        answer: q.answer,
        dispute: q.dispute,
        // 保留原始数据以便 QuestionMessage 组件使用
        ...q,
      }));

      // 按时间倒序排序
      mappedQuestions.sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setQuestions(mappedQuestions);
    } catch (error) {
      console.error('加载提问记录失败:', error);
      Alert.alert('错误', '加载提问记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAppeal = async (question) => {
    if (!appealReason.trim()) {
      Alert.alert('提示', '请输入申诉原因');
      return;
    }

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

      // 后端接口是 /dispute 而不是 /appeal
      const questionId = question.id || question._id;
      const response = await fetch(`${API_BASE_URL}/questions/${questionId}/dispute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${actualToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: appealReason.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('成功', '申诉已提交，等待客服处理');
        setShowAppealModal(false);
        setAppealReason('');
        loadQuestions();
      } else {
        Alert.alert('错误', data.message || '提交申诉失败');
      }
    } catch (error) {
      console.error('提交申诉失败:', error);
      Alert.alert('错误', '提交申诉失败');
    }
  };

  const getStatusText = (status) => {
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
        return '未知';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'accepted':
        return '#007AFF';
      case 'answered':
        return '#34C759';
      case 'completed':
      case 'paid':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'disputed':
      case 'appealed':
        return '#FF9500';
      case 'refunded':
        return '#FF9500';
      default:
        return theme.colors.secondaryText;
    }
  };

  const renderQuestionItem = ({ item }) => {
    // 后端返回的是 askerId/answererId，需要转换为前端期望的格式
    const askerId = item.askerId?._id || item.askerId || item.fromUserId;
    const answererId = item.answererId?._id || item.answererId || item.toUserId;
    const isSent = askerId === currentUserId || item.fromUserId === currentUserId;
    // 后端状态 completed = 已放款，disputed = 申诉中
    const isPaid = item.status === 'paid' || item.status === 'completed';
    const isDisputed = item.status === 'disputed' || item.dispute;
    const canAppeal = isPaid && isSent && !isDisputed;

    return (
      <TouchableOpacity
        style={[
          styles.questionItem,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => setSelectedQuestion(item)}
      >
        <View style={styles.questionHeader}>
          <View style={styles.questionInfo}>
            <Text style={[styles.questionUser, { color: theme.colors.text }]}>
              {isSent 
                ? `向 ${item.toUserName || item.answererId?.username || '用户'}` 
                : `来自 ${item.fromUserName || item.askerId?.username || '用户'}`}
            </Text>
            <Text style={[styles.questionTime, { color: theme.colors.secondaryText }]}>
              {new Date(item.createdAt || item.created_at).toLocaleString('zh-CN')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <Text style={[styles.questionContent, { color: theme.colors.text }]} numberOfLines={2}>
          {item.content}
        </Text>

        <View style={styles.questionFooter}>
          <Text style={[styles.questionPrice, { color: theme.colors.primary }]}>
            ¥{item.price}
          </Text>
          {canAppeal && (
            <TouchableOpacity
              style={[styles.appealButton, { borderColor: theme.colors.border }]}
              onPress={() => {
                setSelectedQuestion(item);
                setShowAppealModal(true);
              }}
            >
              <Text style={[styles.appealButtonText, { color: theme.colors.primary }]}>
                申诉
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 筛选按钮 */}
      <View style={[styles.filterContainer, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'all' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'all' ? '#fff' : theme.colors.text },
            ]}
          >
            全部
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'sent' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setFilter('sent')}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'sent' ? '#fff' : theme.colors.text },
            ]}
          >
            我发出的
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'received' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setFilter('received')}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'received' ? '#fff' : theme.colors.text },
            ]}
          >
            我收到的
          </Text>
        </TouchableOpacity>
      </View>

      {questions.length > 0 ? (
        <FlatList
          data={questions}
          renderItem={renderQuestionItem}
          keyExtractor={(item) => (item.id || item._id).toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>
            暂无付费提问记录
          </Text>
        </View>
      )}

      {/* 问题详情弹窗 */}
      <Modal
        visible={selectedQuestion !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedQuestion(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>提问详情</Text>
              <TouchableOpacity onPress={() => setSelectedQuestion(null)}>
                <Text style={[styles.closeText, { color: theme.colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedQuestion && (
                <QuestionMessage
                  question={selectedQuestion}
                  currentUserId={null}
                  onUpdate={loadQuestions}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 申诉弹窗 */}
      <Modal
        visible={showAppealModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAppealModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>发起申诉</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.secondaryText }]}>
              请说明申诉原因，客服将进行审核
            </Text>

            <TextInput
              style={[
                styles.appealInput,
                {
                  backgroundColor: theme.colors.inputBackground,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="请输入申诉原因..."
              placeholderTextColor={theme.colors.placeholder}
              value={appealReason}
              onChangeText={setAppealReason}
              multiline
              numberOfLines={5}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.inputBackground }]}
                onPress={() => {
                  setShowAppealModal(false);
                  setAppealReason('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => selectedQuestion && handleAppeal(selectedQuestion)}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>提交</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 15,
  },
  questionItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  questionInfo: {
    flex: 1,
  },
  questionUser: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  questionTime: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  appealButton: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  appealButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 15,
  },
  modalBody: {
    maxHeight: 400,
  },
  closeText: {
    fontSize: 24,
  },
  appealInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

