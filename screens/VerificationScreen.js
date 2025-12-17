import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { API_BASE_URL } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// onVerified: 认证通过后回调，更新上层用户状态
export default function VerificationScreen({ navigation, route, onVerified }) {
  const [loading, setLoading] = useState(false);
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');

  const handleSubmit = async () => {
    if (!realName.trim()) {
      Alert.alert('错误', '请输入真实姓名');
      return;
    }
    if (
      !idCard ||
      !/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(
        idCard,
      )
    ) {
      Alert.alert('错误', '请输入正确的身份证号码');
      return;
    }

    setLoading(true);
    try {
      // 1. 调用后端二要素校验
      const verifyResp = await fetch(`${API_BASE_URL}/verify-idcard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idCard: idCard.trim(),
          name: realName.trim(),
        }),
      });

      const verifyData = await verifyResp.json();

      if (!verifyResp.ok || !verifyData.success) {
        Alert.alert(
          '身份验证失败',
          verifyData.message || '姓名和身份证号不匹配，请检查后重试',
        );
        return;
      }

      // 2. 本地更新用户为已认证
      const userStr = await AsyncStorage.getItem('user');
      let user = userStr ? JSON.parse(userStr) : {};
      user = {
        ...user,
        realName: realName.trim(),
        idCard: idCard.trim(),
        isVerified: true,
      };
      await AsyncStorage.setItem('user', JSON.stringify(user));

      if (onVerified) {
        // 通知上层更新状态
        await onVerified(user);
      }

      Alert.alert('认证成功', '您的身份已通过验证', [
        {
          text: '进入主页',
          onPress: () => {
            // 重置导航到主界面
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          },
        },
      ]);
    } catch (error) {
      console.error('认证错误:', error);
      Alert.alert('错误', '身份验证服务异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>实名认证</Text>
        <Text style={styles.subtitle}>
          为了保证平台安全和信息真实，请先完成身份信息认证。
          只需填写真实姓名和身份证号。
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            真实姓名 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="请输入真实姓名（与身份证一致）"
            value={realName}
            onChangeText={setRealName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            身份证号 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="请输入18位身份证号码"
            value={idCard}
            onChangeText={setIdCard}
            keyboardType="numeric"
            maxLength={18}
          />
          <Text style={styles.hint}>
            我们将通过腾讯云二要素核验（姓名 + 身份证号），仅用于身份验证。
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>提交认证</Text>
          )}
        </TouchableOpacity>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>📋 说明</Text>
          <Text style={styles.noticeText}>
            1. 认证信息仅用于身份核验，不会对外展示身份证号{'\n'}
            2. 通过认证后，您才能正常使用 Lily Chat 的地图和聊天功能{'\n'}
            3. 如有问题，请联系平台客服
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    fontWeight: '500',
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noticeBox: {
    backgroundColor: '#F0F7FF',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 20,
  },
});

