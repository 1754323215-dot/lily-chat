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
import { useTheme } from '../contexts/ThemeContext';

export default function AuthScreen({ onLoginSuccess }) {
  const { theme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    realName: '',
    idCard: '',
  });

  const handleSubmit = async () => {
    if (isLogin) {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  // 登录：真实姓名 + 身份证号
  const handleLogin = async () => {
    if (!formData.realName) {
      Alert.alert('错误', '请输入真实姓名');
      return;
    }
    if (!formData.idCard) {
      Alert.alert('错误', '请输入身份证号');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          realName: formData.realName,
          idCard: formData.idCard,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        if (onLoginSuccess) {
          onLoginSuccess(data.user, data.token);
        }
      } else {
        Alert.alert('登录失败', data.message || '用户名或身份证号错误');
      }
    } catch (error) {
      console.error('登录错误:', error);
      Alert.alert('错误', '网络连接失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  // 注册：用户名 + 真名 + 身份证号
  const handleRegister = async () => {
    if (!formData.username) {
      Alert.alert('错误', '请输入用户名');
      return;
    }
    if (!formData.realName) {
      Alert.alert('错误', '请输入真实姓名');
      return;
    }
    if (!formData.idCard) {
      Alert.alert('错误', '请输入身份证号');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          realName: formData.realName,
          idCard: formData.idCard,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        Alert.alert('注册成功', '注册已完成，欢迎使用 Lily Chat', [
          {
            text: '确定',
            onPress: () => {
              if (onLoginSuccess) {
                onLoginSuccess(data.user, data.token);
              }
            },
          },
        ]);
      } else {
        Alert.alert('注册失败', data.message || '注册失败，请重试');
      }
    } catch (error) {
      console.error('注册错误:', error);
      Alert.alert('错误', '网络连接失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: theme.colors.primary }]}>Lily Chat</Text>
        <Text style={[styles.subtitle, { color: theme.colors.secondaryText }]}>
          {isLogin ? '登录' : '注册'}（登录仅需真实姓名和身份证号，注册需要额外设置用户名）
        </Text>
      </View>

      <View style={styles.form}>
        {/* 登录模式：真实姓名 + 身份证号 */}
        {isLogin && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>真实姓名 *</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="请输入真实姓名"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.realName}
              onChangeText={(text) => setFormData({ ...formData, realName: text })}
            />
          </View>
        )}

        {/* 注册模式：用户名 + 真实姓名 */}
        {!isLogin && (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>用户名（不限字数）*</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="请输入用户名"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>真实姓名 *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="请输入真实姓名"
                placeholderTextColor={theme.colors.placeholder}
                value={formData.realName}
                onChangeText={(text) => setFormData({ ...formData, realName: text })}
              />
            </View>
          </>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>身份证号 *</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
              color: theme.colors.text
            }]}
            placeholder="请输入身份证号"
            placeholderTextColor={theme.colors.placeholder}
            value={formData.idCard}
            onChangeText={(text) => setFormData({ ...formData, idCard: text })}
            keyboardType="number-pad"
            maxLength={18}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.colors.primary }, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isLogin ? '登录' : '注册'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsLogin(!isLogin);
            setFormData({
              username: '',
              realName: '',
              idCard: '',
            });
          }}
        >
          <Text style={[styles.switchText, { color: theme.colors.primary }]}>
            {isLogin ? '还没有账号？立即注册' : '已有账号？立即登录'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.tipText, { color: theme.colors.secondaryText }]}>
          邮箱、密码、头像等其他资料可在登录后到「个人主页」中完善。
        </Text>

        {/* 当前后端地址（调试用） */}
        <Text style={[styles.debugText, { color: theme.colors.placeholder }]}>当前后端: {API_BASE_URL}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
  },
  tipText: {
    marginTop: 20,
    fontSize: 12,
    textAlign: 'center',
  },
  debugText: {
    marginTop: 10,
    fontSize: 10,
  },
});

