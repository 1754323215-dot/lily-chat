import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, formatToken } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ChatScreen({ route, navigation }) {
  const { theme } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  // 如果导航参数中包含直接跳转到 ChatDetail 的请求，自动跳转
  useFocusEffect(
    React.useCallback(() => {
      // 检查是否有需要跳转到 ChatDetail 的参数
      const chatDetailParams = route?.params?.screen === 'ChatDetail' ? route?.params?.params : null;
      if (chatDetailParams) {
        console.log('检测到需要跳转到 ChatDetail，参数:', chatDetailParams);
        // 延迟一下，确保导航栈已经准备好
        const timer = setTimeout(() => {
          navigation.navigate('ChatDetail', chatDetailParams);
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [route?.params, navigation])
  );

  // 如果从地图页面传入目标用户，创建新对话（仅插入列表，点击可进入后续私聊页面，当前保持简单列表）
  useEffect(() => {
    if (route?.params?.targetUser) {
      const targetUser = route.params.targetUser;
      setChats((prev) => {
        const exists = prev.find((c) => c.id === targetUser.id);
        if (exists) return prev;
        return [
          {
            id: targetUser.id,
            userId: targetUser.id,
            userName: targetUser.name,
            avatar: targetUser.avatar,
            lastMessage: '',
            lastMessageTime: '',
            unreadCount: 0,
          },
          ...prev,
        ];
      });
    }
  }, [route?.params]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('未登录');
      }
      
      // 确保 token 格式正确（后端期望 token-{userId} 格式）
      const actualToken = formatToken(token);
      if (!actualToken) {
        throw new Error('未登录');
      }
      
      console.log('Token 格式检查:', actualToken.substring(0, 30) + '...');
      
      const url = `${API_BASE_URL}/messages/contacts`;
      
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${actualToken}`,
        },
      });
      
      console.log('响应状态:', resp.status, resp.statusText);
      
      // 检查响应内容类型
      const contentType = resp.headers.get('content-type');
      console.log('响应 Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await resp.text();
        console.error('服务器返回非 JSON 响应:', text.substring(0, 200));
        throw new Error('服务器返回格式错误');
      }
      
      const data = await resp.json();
      console.log('响应数据:', data);
      
      if (resp.ok && Array.isArray(data)) {
        const mapped = data.map((c) => ({
          id: c.id,
          userId: c.id,
          userName: c.username,
          avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.username || 'user')}`,
          lastMessage: c.lastMessage || '',
          lastMessageTime: c.lastTime ? new Date(c.lastTime).toLocaleTimeString() : '',
          unreadCount: 0,
        }));
        setChats(mapped);
      } else {
        // 如果是 401 未授权，记录更详细的错误信息
        if (resp.status === 401) {
          console.error('认证失败，状态码 401');
          console.error('错误信息:', data?.message);
          console.error('Token 值:', token);
          throw new Error(data?.message || '未授权，请重新登录');
        }
        throw new Error(data?.message || '加载联系人失败');
      }
    } catch (error) {
      console.error('加载联系人失败', error);
      
      // 如果认证失败或网络错误，使用空列表而不是模拟数据
      // 只有在确实无法连接服务器时才使用备用数据
      if (error.message.includes('网络') || error.message.includes('连接')) {
        setChats([
          {
            id: 'mock-1',
            userId: 'mock-1',
            userName: '示例用户A',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sampleA',
            lastMessage: '你好，这里是示例对话',
            lastMessageTime: '10:30',
            unreadCount: 0,
          },
        ]);
      } else {
        // 其他错误（如认证失败、服务器错误等）显示空列表
        setChats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChatPress = (item) => {
    if (navigation) {
      navigation.navigate('ChatDetail', {
        userId: item.userId,
        userName: item.userName,
        avatar: item.avatar,
      });
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.chatItem, { borderBottomColor: theme.colors.border }]}
      onPress={() => handleChatPress(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>{item.userName}</Text>
          <Text style={[styles.time, { color: theme.colors.placeholder }]}>{item.lastMessageTime}</Text>
        </View>
        <View style={styles.chatFooter}>
          <Text style={[styles.lastMessage, { color: theme.colors.secondaryText }]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { 
        backgroundColor: theme.colors.card,
        borderBottomColor: theme.colors.border 
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>聊天</Text>
      </View>
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text }]}>加载中...</Text>
        </View>
      ) : chats.length > 0 ? (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.chatList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text }]}>暂无聊天记录</Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.secondaryText }]}>
            在地图上点击用户头像开始对话
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

