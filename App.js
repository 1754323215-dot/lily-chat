import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Image, Platform, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import AuthScreen from './screens/AuthScreen';
import VerificationScreen from './screens/VerificationScreen';
import MapScreen from './screens/MapScreen';
import ChatScreen from './screens/ChatScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import QuestionHistoryScreen from './screens/QuestionHistoryScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 聊天相关页面 Stack
function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatScreen} />
      <Stack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  );
}

// 主应用导航（已登录）
function MainTabs({ user, onLogout }) {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          elevation: 10,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          backgroundColor: theme.colors.card,
        },
        tabBarIcon: ({ focused, color, size }) => {
          // 使用文本图标作为图标
          const iconEmoji = route.name === 'Map' ? '🗺' : route.name === 'Chat' ? '💬' : '👤';

          return (
            <View style={{ width: size || 28, height: size || 28, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: focused ? theme.colors.primary : theme.colors.text, opacity: focused ? 1 : 0.5 }}>
                {iconEmoji}
              </Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Chat" component={ChatStack} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// 配置通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 主应用（包含认证流程）
function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme, isDark } = useTheme();
  const notificationListener = useRef();
  const responseListener = useRef();
  const navigationRef = useRef();
  const pushTokenRegistered = useRef(false);
  const pushTokenRegistering = useRef(false);
  const listenersSetup = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      if (!pushTokenRegistered.current && !pushTokenRegistering.current) {
        registerForPushNotificationsAsync();
      }
      if (!listenersSetup.current) {
        setupNotificationListeners();
        listenersSetup.current = true;
      }
    } else {
      // 用户登出时重置状态
      pushTokenRegistered.current = false;
      pushTokenRegistering.current = false;
      listenersSetup.current = false;
    }
    
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
        notificationListener.current = null;
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
        responseListener.current = null;
      }
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 确保即使出错也能继续运行
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (userData, token) => {
    setUser(userData);
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  // 注册推送通知权限
  const registerForPushNotificationsAsync = async () => {
    // 防止重复调用
    if (pushTokenRegistering.current || pushTokenRegistered.current) {
      return;
    }

    pushTokenRegistering.current = true;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('通知权限未授予');
        pushTokenRegistering.current = false;
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // 尝试从 Constants 获取 projectId（EAS 项目）
      let projectId;
      try {
        // 优先从 Constants.expoConfig.extra.eas.projectId 获取
        projectId = Constants?.expoConfig?.extra?.eas?.projectId;
        // 如果没有，尝试从 Constants.expoConfig.extra 获取
        if (!projectId) {
          projectId = Constants?.expoConfig?.extra?.projectId;
        }
      } catch (e) {
        console.log('无法从 Constants 获取 projectId:', e);
      }

      // 检查是否在 Expo Go 环境中（Expo Go 不支持远程推送通知）
      const isExpoGo = Constants.executionEnvironment === 'storeClient';
      
      // 在 Expo Go 中，远程推送通知不可用，跳过 token 获取
      if (isExpoGo) {
        console.log('Expo Go 环境：远程推送通知不可用，跳过 token 获取');
        pushTokenRegistered.current = true; // 标记为已处理，避免重复尝试
        pushTokenRegistering.current = false;
        return;
      }

      // 获取推送 token（仅在生产构建中）
      let token;
      try {
        // 如果有 projectId，使用它；否则让 Expo 自动检测
        if (projectId) {
          token = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
        } else {
          // 不传递 projectId，让 Expo 自动检测
          token = await Notifications.getExpoPushTokenAsync();
        }
      } catch (tokenError) {
        // 如果获取失败，记录错误但不影响应用运行
        // 检查是否是 projectId 相关的错误
        if (tokenError.message.includes('projectId')) {
          console.log('推送 token 获取失败：需要配置 projectId（开发构建中需要）');
        } else {
          console.error('推送 token 获取失败:', tokenError.message);
        }
        pushTokenRegistered.current = true; // 标记为已处理，避免重复尝试
        pushTokenRegistering.current = false;
        return;
      }
      
      console.log('推送通知 Token:', token.data);
      
      // 可以将 token 发送到后端保存
      const userToken = await AsyncStorage.getItem('token');
      if (userToken && token.data) {
        // TODO: 发送 token 到后端
        // await fetch(`${API_BASE_URL}/users/push-token`, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${userToken}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({ pushToken: token.data }),
        // });
      }

      pushTokenRegistered.current = true;
    } catch (error) {
      console.error('注册推送通知失败:', error);
    } finally {
      pushTokenRegistering.current = false;
    }
  };

  // 设置通知监听器
  const setupNotificationListeners = () => {
    if (!user) return; // 未登录时不设置监听器
    if (listenersSetup.current) return; // 已经设置过，避免重复

    // 先移除旧的监听器（如果存在）
    if (notificationListener.current) {
      Notifications.removeNotificationSubscription(notificationListener.current);
    }
    if (responseListener.current) {
      Notifications.removeNotificationSubscription(responseListener.current);
    }

    // 前台通知监听
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('收到通知:', notification);
    });

    // 通知点击监听
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('通知被点击:', data);
      
      // 如果通知包含问题ID，导航到聊天详情页
      if (data.questionId && navigationRef.current) {
        // 确保在主界面中导航
        navigationRef.current.navigate('Main', {
          screen: 'Chat',
          params: {
            screen: 'ChatDetail',
            params: {
              questionId: data.questionId,
              userId: data.userId,
              userName: data.userName || '用户',
              avatar: data.avatar,
            },
          },
        });
      } else if (data.userId && navigationRef.current) {
        // 如果只有用户ID，导航到聊天详情页
        navigationRef.current.navigate('Main', {
          screen: 'Chat',
          params: {
            screen: 'ChatDetail',
            params: {
              userId: data.userId,
              userName: data.userName || '用户',
              avatar: data.avatar,
            },
          },
        });
      }
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // 未登录：显示登录/注册页面（注册时已经做实名认证）
          <Stack.Screen name="Auth">
            {(props) => (
              <AuthScreen
                {...props}
                onLoginSuccess={handleLoginSuccess}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            {/* 已登录：直接进入主界面 */}
          <Stack.Screen name="Main">
            {(props) => <MainTabs {...props} user={user} onLogout={handleLogout} />}
          </Stack.Screen>
            {/* 付费提问记录页面（可从个人中心进入） */}
            <Stack.Screen 
              name="QuestionHistory" 
              component={QuestionHistoryScreen}
              options={{ headerShown: true }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
