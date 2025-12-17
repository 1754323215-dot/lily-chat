import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

export default function QuestionNotificationBanner({ navigation }) {
  const { theme } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [latestQuestion, setLatestQuestion] = useState(null);

  useEffect(() => {
    loadPendingQuestions();
    // 每30秒刷新一次
    const interval = setInterval(loadPendingQuestions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingQuestions = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setPendingCount(0);
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/questions/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const questions = Array.isArray(data.questions) ? data.questions : [];
        setPendingCount(questions.length);
        if (questions.length > 0) {
          // 获取最新的提问
          const sorted = questions.sort((a, b) => 
            new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
          );
          setLatestQuestion(sorted[0]);
        } else {
          setLatestQuestion(null);
        }
      }
    } catch (error) {
      console.error('加载待处理提问失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (latestQuestion && navigation) {
      navigation.navigate('ChatDetail', {
        questionId: latestQuestion.id || latestQuestion._id,
        userId: latestQuestion.fromUserId || latestQuestion.fromUser,
        userName: latestQuestion.fromUserName || '用户',
        avatar: latestQuestion.fromUserAvatar,
      });
    }
  };

  if (loading || pendingCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.primary,
          borderBottomColor: theme.colors.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>💰</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            您有 {pendingCount} 个新的付费提问
          </Text>
          {latestQuestion && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {latestQuestion.fromUserName || '用户'} 向您提问：¥{latestQuestion.price}
            </Text>
          )}
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
  },
  arrow: {
    color: '#fff',
    fontSize: 24,
    marginLeft: 8,
  },
});

