import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { AMAP_KEY, API_BASE_URL, formatToken } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserCard from '../components/UserCard';
import ClusterUserList from '../components/ClusterUserList';
import QuestionNotificationBanner from '../components/QuestionNotificationBanner';
import { useTheme } from '../contexts/ThemeContext';

// === 坐标系转换：WGS84 -> GCJ-02（高德使用 GCJ-02） ===
const PI = 3.1415926535897932384626;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) +
      20.0 * Math.sin(2.0 * x * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) +
      320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(x, y) {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) +
      20.0 * Math.sin(2.0 * x * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) +
      300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
}

function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lat, lng)) {
    return { latitude: lat, longitude: lng };
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat =
    (dLat * 180.0) /
    (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng =
    (dLng * 180.0) /
    ((A / sqrtMagic) * Math.cos(radLat) * PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return { latitude: mgLat, longitude: mgLng };
}

export default function MapScreen({ navigation }) {
  const { theme } = useTheme();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'permission' | 'timeout' | 'network' | 'unknown'
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserCard, setShowUserCard] = useState(false);
  const [clusterUsers, setClusterUsers] = useState([]);
  const [showClusterList, setShowClusterList] = useState(false);
  const webViewRef = useRef(null);

  // 模拟用户数据（包含标签信息）
  const mockUsers = [
    // 密集区域（模拟聚合）
    {
      id: 1,
      name: '张三',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
      lat: 0,
      lng: 0,
      tags: [
        { id: 1, name: '山东工商学院', type: 'required', level: 2, verified: true },
        { id: 2, name: '计算机科学', type: 'custom', level: 1, verified: false },
      ],
    },
    {
      id: 2,
      name: '李四',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
      lat: 0.0001,
      lng: 0.0001,
      tags: [
        { id: 1, name: '腾讯科技', type: 'required', level: 2, verified: true },
        { id: 2, name: '前端开发', type: 'custom', level: 1, verified: false },
      ],
    },
    {
      id: 3,
      name: '王五',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
      lat: 0.0002,
      lng: 0,
      tags: [
        { id: 1, name: '北京大学', type: 'optional', level: 2, verified: true },
        { id: 2, name: '算法工程师', type: 'custom', level: 1, verified: false },
      ],
    },
    {
      id: 4,
      name: '赵六',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
      lat: 0,
      lng: 0.0002,
      tags: [
        { id: 1, name: '山东工商学院', type: 'required', level: 1, verified: false },
      ],
    },
    // 分散用户
    {
      id: 5,
      name: '孙七',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
      lat: 0.01,
      lng: 0.01,
      tags: [
        { id: 1, name: '阿里巴巴', type: 'required', level: 2, verified: true },
        { id: 2, name: '产品经理', type: 'custom', level: 1, verified: false },
      ],
    },
  ];

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    
    try {
      // 先检查权限状态（在应用分身环境中，这一步可能会失败）
      let existingStatus;
      try {
        const permissionResult = await Location.getForegroundPermissionsAsync();
        existingStatus = permissionResult.status;
      } catch (checkError) {
        // 如果检查权限时出错（可能是应用分身环境），尝试直接请求权限
        console.warn('检查权限状态失败，尝试直接请求权限:', checkError);
        existingStatus = 'undetermined';
      }
      
      let finalStatus = existingStatus;
      
      // 如果权限未授予，请求权限
      if (existingStatus !== 'granted') {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
          finalStatus = status;
        } catch (requestError) {
          // 如果请求权限时出错，检查是否是用户句柄问题（应用分身）
          if (requestError.message && (requestError.message.includes('UserHandle') || requestError.message.includes('user handle'))) {
            throw new Error('UserHandle: 检测到应用分身环境，请在系统设置中为应用分身授予定位权限');
          }
          throw requestError;
        }
      }
      
      // 权限被拒绝
      if (finalStatus !== 'granted') {
        setError('定位权限被拒绝，无法获取位置信息');
        setErrorType('permission');
        setLoading(false);
        return;
      }

      // 获取位置（expo-location 的 getCurrentPositionAsync 支持 timeout 选项）
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000, // 10秒超时
      });

      const rawLat = current.coords.latitude;
      const rawLng = current.coords.longitude;
      
      const gcj = wgs84ToGcj02(rawLat, rawLng);

      setLocation({
        latitude: gcj.latitude,
        longitude: gcj.longitude,
      });
      
      // 清除错误状态
      setError(null);
      setErrorType(null);
      
      // 更新用户位置到后端（这样虚拟用户会自动跟随到用户附近）
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const actualToken = formatToken(token);
          await fetch(`${API_BASE_URL}/users/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${actualToken}`,
            },
            body: JSON.stringify({
              latitude: gcj.latitude,
              longitude: gcj.longitude,
              address: '当前位置',
            }),
          });
          console.log('✅ 用户位置已更新到后端');
        }
      } catch (updateError) {
        console.error('更新用户位置失败:', updateError);
        // 不阻止后续流程
      }
      
      // 拿到定位后，去后台拉取附近用户
      fetchNearbyUsers(gcj.latitude, gcj.longitude);
      setLoading(false);
    } catch (error) {
      console.error('获取位置失败:', error);
      
      // 根据错误类型设置错误信息
      let errorMessage = '获取位置失败';
      let type = 'unknown';
      
      // 检查是否是 Android 多用户环境错误（应用分身/工作配置文件）
      if (error.message.includes('UserHandle') || error.message.includes('user handle') || error.message.includes('not allowed on UserHandle')) {
        errorMessage = '检测到应用分身环境。请在系统设置中为应用分身授予定位权限：\n1. 打开"设置" → "应用" → 找到应用分身\n2. 进入"权限" → 开启"位置信息"权限\n3. 返回应用重试';
        type = 'permission';
      } else if (error.message.includes('超时') || error.message.includes('timeout')) {
        errorMessage = '获取位置超时，请检查GPS是否开启';
        type = 'timeout';
      } else if (error.message.includes('权限') || error.message.includes('permission') || error.message.includes('rejected')) {
        errorMessage = '定位权限被拒绝，无法获取位置信息';
        type = 'permission';
      } else if (error.message.includes('网络') || error.message.includes('network')) {
        errorMessage = '网络错误，请检查网络连接';
        type = 'network';
      } else {
        errorMessage = error.message || '获取位置失败，请重试';
        type = 'unknown';
      }
      
      setError(errorMessage);
      setErrorType(type);
      setLoading(false);
    }
  };

  // 重试获取位置
  const handleRetry = () => {
    getCurrentLocation();
  };

  // 打开系统设置
  const openSettings = async () => {
    try {
      await Location.openSettingsAsync();
    } catch (error) {
      console.error('打开设置失败:', error);
      Alert.alert('提示', '无法打开设置页面，请手动前往系统设置开启定位权限');
    }
  };

  const fetchNearbyUsers = async (lat, lng) => {
    setLoadingUsers(true);
    try {
      const url = `${API_BASE_URL}/users/nearby`;
      console.log('请求附近用户 URL:', url, '坐标:', lat, lng);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      const data = await resp.json();
      console.log('附近用户返回:', resp.status, data);
      if (!resp.ok) {
        throw new Error(data.message || '获取附近用户失败');
      }
      if (Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.error('获取附近用户错误:', e);
      Alert.alert('提示', '附近用户加载失败，暂时使用本地模拟数据');
      // 保留原来的 mock 行为：不设置 users 时，下面会用 mockUsers
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 处理 WebView 消息
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('收到 WebView 消息:', data.type, data);
      
      if (data.type === 'userClick') {
        // Web 端已经带上完整的用户信息
        setSelectedUser(data.user);
        setShowUserCard(true);
      } else if (data.type === 'clusterClick') {
        // Web 端直接把该聚合里的所有用户列表传回来
        if (Array.isArray(data.users)) {
          setClusterUsers(data.users);
          setShowClusterList(true);
        }
      } else if (data.type === 'mapError') {
        console.error('地图错误:', data.message);
        Alert.alert('地图错误', data.message || '地图加载失败');
      } else if (data.type === 'apiLoadError') {
        console.error('API 加载错误:', data.message);
        Alert.alert('高德地图 API 加载失败', data.message || '请检查网络连接和 API Key 配置');
      } else if (data.type === 'apiLoadTimeout') {
        console.error('API 加载超时:', data.message);
        Alert.alert('地图加载超时', data.message || '请检查网络连接');
      }
    } catch (error) {
      console.error('消息处理错误:', error);
      console.error('原始数据:', event.nativeEvent.data);
    }
  };

  // 处理私聊
  const handleChat = (user) => {
    // 导航到聊天页面，并传递用户信息
    if (navigation) {
      navigation.navigate('Chat', { targetUser: user });
    }
  };

  const generateMapHTML = () => {
    if (!location) {
      return '';
    }

    // 如果后端没返回用户，就退回到本地模拟数据（兼容网络异常）
    const finalUsers = (users && users.length > 0
      ? users
      : mockUsers.map(u => ({
          ...u,
          lat: location.latitude + u.lat,
          lng: location.longitude + u.lng,
        })));

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <title>Lily Chat Map</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html { 
              width: 100%; 
              height: 100%; 
              overflow: hidden;
              position: fixed;
            }
            #container { 
              width: 100%;
              height: 100%;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
            }
            .user-marker {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 2px solid #fff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              background-size: cover;
              background-position: center;
              background-color: #eee;
            }
            .cluster-marker {
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background-color: rgba(0, 122, 255, 0.9);
              color: white;
              display: flex;
              justify-content: center;
              align-items: center;
              font-weight: bold;
              font-size: 14px;
              border: 2px solid #fff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
          </style>
          <script type="text/javascript" src="https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.MarkerClusterer" 
            onload="console.log('高德地图 API 脚本加载成功'); window.AMapLoaded = true;"
            onerror="console.error('高德地图 API 加载失败'); window.AMapLoadError = true; if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'apiLoadError',message:'高德地图 API 加载失败'}));}"></script>
        </head>
        <body>
          <div id="container"></div>
          <script>
            console.log('开始初始化地图...');
            console.log('API Key:', '${AMAP_KEY}');
            console.log('位置信息:', ${location.longitude}, ${location.latitude});
            
            // 记录 API 加载状态
            var apiLoadCheckCount = 0;
            var maxApiCheckAttempts = 50; // 最多检查 5 秒（50 * 100ms）
            
            // 等待 DOM 和 AMap 加载完成
            function initMap() {
              try {
                apiLoadCheckCount++;
                console.log('检查 AMap 加载状态，尝试次数:', apiLoadCheckCount);
                
                if (typeof AMap === 'undefined') {
                  console.error('AMap 未加载');
                  if (window.AMapLoadError) {
                    console.error('API 脚本加载失败');
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'apiLoadError',
                        message: '高德地图 API 脚本加载失败，请检查网络连接和 API Key'
                      }));
                    }
                    return;
                  }
                  
                  // 如果还没加载完成，继续等待
                  if (apiLoadCheckCount < maxApiCheckAttempts) {
                    setTimeout(initMap, 100);
                    return;
                  } else {
                    console.error('AMap API 加载超时');
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'apiLoadTimeout',
                        message: '高德地图 API 加载超时，请检查网络连接'
                      }));
                    }
                    return;
                  }
                }
                
                console.log('AMap API 已加载，版本:', AMap.version || 'unknown');
                
                // 确保容器存在且有尺寸
                var container = document.getElementById('container');
                if (!container) {
                  console.error('容器元素不存在');
                  return;
                }
                
                // 确保容器有正确的尺寸
                var width = window.innerWidth || document.documentElement.clientWidth || 375;
                var height = window.innerHeight || document.documentElement.clientHeight || 667;
                container.style.width = width + 'px';
                container.style.height = height + 'px';
                console.log('容器尺寸:', width, height, '实际尺寸:', container.offsetWidth, container.offsetHeight);
                
                console.log('创建地图实例...');
                console.log('地图中心点:', ${location.longitude}, ${location.latitude});
                
                console.log('高德地图 Key:', '${AMAP_KEY}');
                
                // 使用最简化的地图配置，避免参数冲突
                var map = new AMap.Map('container', {
                  zoom: 15,
                  center: [${location.longitude}, ${location.latitude}],
                  resizeEnable: true,
                  // 添加地图类型，确保使用标准地图
                  mapStyle: 'normal',
                });
                

                // 添加地图加载错误处理
                map.on('error', function(e) {
                  console.error('地图实例错误:', e);
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'mapError',
                      message: '地图加载错误: ' + (e.message || '未知错误')
                    }));
                  }
                });

                // 监听地图瓦片加载失败
                map.on('tilesloaded', function() {
                  console.log('地图瓦片已加载');
                });

                // 监听地图瓦片加载事件
                map.on('complete', function() {
                  console.log('地图瓦片加载完成');

                  // 用户数据（来自后端或本地模拟）
                  var users = ${JSON.stringify(finalUsers)};
                  console.log('用户数据:', users);
                  
                  // 转换数据为点标记
                  var markers = users.map(function(user) {
                    // 创建自定义内容
                    var content = document.createElement('div');
                    content.className = 'user-marker';
                    content.style.backgroundImage = 'url(' + user.avatar + ')';
                    
                    var marker = new AMap.Marker({
                      position: [user.lng, user.lat],
                      content: content,
                      offset: new AMap.Pixel(-20, -40),
                      extData: user,
                      map: map
                    });

                    marker.on('click', function(e) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'userClick',
                          user: e.target.getExtData()
                        }));
                      }
                    });

                    return marker;
                  });

                  // 创建聚合（使用 MarkerClusterer，注意插件名称）
                  var cluster = new AMap.MarkerClusterer(map, markers, {
                    gridSize: 60,
                    renderClusterMarker: function(context) {
                      var count = context.count;
                      var div = document.createElement('div');
                      div.className = 'cluster-marker';
                      div.innerHTML = count;
                      
                      // 根据数量改变颜色
                      if (count > 10) {
                        div.style.backgroundColor = 'rgba(255, 59, 48, 0.9)';
                      } else if (count > 5) {
                        div.style.backgroundColor = 'rgba(255, 149, 0, 0.9)';
                      }
                      
                      context.marker.setContent(div);
                      context.marker.setOffset(new AMap.Pixel(-22, -22));
                      
                      context.marker.on('click', function(e) {
                        // 获取该聚合里的所有 marker 对应的用户
                        var childMarkers = context.markers || [];
                        var clusterUsers = childMarkers.map(function(m) {
                          return m.getExtData();
                        }).filter(Boolean);

                        if (window.ReactNativeWebView) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'clusterClick',
                            count: count,
                            users: clusterUsers
                          }));
                        }
                      });
                    }
                  });
                  
                  console.log('地图初始化完成，标记数量:', markers.length);
                });

                // 地图实例的错误处理已在上面添加
              } catch (error) {
                console.error('初始化地图失败:', error);
                console.error('错误堆栈:', error.stack);
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapError',
                    message: '地图初始化失败: ' + (error.message || '未知错误')
                  }));
                }
              }
            }

            // DOM 加载完成后尝试初始化
            function startInit() {
              console.log('DOM 状态:', document.readyState);
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                console.log('DOM 已就绪，开始初始化地图');
                initMap();
              } else {
                console.log('等待 DOM 加载...');
                document.addEventListener('DOMContentLoaded', function() {
                  console.log('DOMContentLoaded 事件触发');
                  initMap();
                });
                window.addEventListener('load', function() {
                  console.log('load 事件触发');
                  initMap();
                });
              }
              
              // 备用：延迟初始化（确保即使事件未触发也能初始化）
              setTimeout(function() {
                if (typeof AMap !== 'undefined' && document.getElementById('container')) {
                  console.log('延迟初始化触发');
                  initMap();
                } else if (typeof AMap === 'undefined') {
                  console.warn('延迟初始化时 AMap 仍未加载');
                }
              }, 1000);
            }
            
            // 监听脚本加载错误
            window.addEventListener('error', function(e) {
              console.error('全局错误捕获:', e.message, e.filename, e.lineno);
              if (e.filename && e.filename.includes('amap.com')) {
                console.error('高德地图脚本加载错误');
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'apiLoadError',
                    message: '高德地图脚本加载错误: ' + e.message
                  }));
                }
              }
            }, true);
            
            // 开始初始化流程
            startInit();
          </script>
        </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.secondaryText }]}>正在定位...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error || '#ff4444' }]}>
          {error || '无法获取位置信息'}
        </Text>
        
        {errorType === 'permission' && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={openSettings}
            >
              <Text style={styles.buttonText}>打开设置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.retryButton, { borderColor: theme.colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>重试</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {errorType !== 'permission' && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 20 }]}
            onPress={handleRetry}
          >
            <Text style={styles.buttonText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.secondaryBackground }]}>
      {/* 付费提问通知横幅 */}
      <QuestionNotificationBanner navigation={navigation} />
      
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView 错误:', nativeEvent);
          console.error('错误代码:', nativeEvent.code);
          console.error('错误描述:', nativeEvent.description);
          console.error('错误 URL:', nativeEvent.url);
          Alert.alert('地图加载错误', `错误代码: ${nativeEvent.code}\n${nativeEvent.description || '未知错误'}`);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView HTTP 错误:', nativeEvent.statusCode);
          console.error('请求 URL:', nativeEvent.url);
          if (nativeEvent.url && nativeEvent.url.includes('webapi.amap.com')) {
            Alert.alert('高德地图 API 加载失败', `HTTP ${nativeEvent.statusCode}\n请检查网络连接和 API Key 配置`);
          }
        }}
        onLoadEnd={() => {
          console.log('WebView 加载完成');
        }}
        onLoadStart={() => {
          console.log('WebView 开始加载');
        }}
        onConsoleMessage={(event) => {
          const message = event.nativeEvent.message;
          console.log('WebView Console:', message);
          // 如果看到错误信息，显示给用户
          if (message.includes('加载失败') || message.includes('error') || message.includes('Error') || message.includes('失败')) {
            console.error('地图加载问题:', message);
          }
        }}
      />

      {/* 小型调试信息：当前定位坐标 & 用户加载状态（方便你核对是否真实） */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          当前坐标（GCJ-02）：{location.latitude.toFixed(6)},{' '}
          {location.longitude.toFixed(6)}
        </Text>
        <Text style={styles.debugText}>
          附近用户：{loadingUsers ? '加载中...' : `${users.length || mockUsers.length} 人`}
        </Text>
      </View>
      
      {/* 用户卡片 */}
      <UserCard
        visible={showUserCard}
        user={selectedUser}
        onClose={() => {
          setShowUserCard(false);
          setSelectedUser(null);
        }}
        onChat={handleChat}
        currentUserId={null}
      />

      {/* 聚合用户列表 */}
      <ClusterUserList
        visible={showClusterList}
        users={clusterUsers}
        onClose={() => {
          setShowClusterList(false);
          setClusterUsers([]);
        }}
        onUserSelect={(user) => {
          setSelectedUser(user);
          setShowUserCard(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#fff',
  },
});
