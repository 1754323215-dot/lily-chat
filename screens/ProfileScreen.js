import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAG_TYPES, TAG_LEVELS, createTag, validateTag } from '../models/Tag';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL, formatToken } from '../constants/config';

export default function ProfileScreen({ navigation, onLogout }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('unverified'); // unverified, pending, verified, rejected
  const [tags, setTags] = useState([]);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState('custom');
  const [proofText, setProofText] = useState('');
  const [proofImages, setProofImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: '',
    password: '',
    avatarUrl: '',
    wechatQRCode: '',
    alipayQRCode: '',
    notificationPreference: 'inApp',
  });

  useEffect(() => {
    loadUserInfo();
    loadTags();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setVerificationStatus(user.verificationStatus || 'unverified');
        setProfileForm({
          email: user.email || '',
          password: '',
          avatarUrl: user.avatar || '',
          wechatQRCode: user.paymentQRCode?.wechat || '',
          alipayQRCode: user.paymentQRCode?.alipay || '',
          notificationPreference: user.notificationPreference === 'notification' ? 'notification' : 'inApp',
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const handleSaveProfile = async () => {
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

      setUploading(true);

      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${actualToken}`,
        },
        body: JSON.stringify({
          email: profileForm.email,
          password: profileForm.password || undefined,
          avatar: profileForm.avatarUrl || undefined,
          paymentQRCode: {
            wechat: profileForm.wechatQRCode || null,
            alipay: profileForm.alipayQRCode || null,
          },
          notificationPreference: profileForm.notificationPreference === 'notification' ? 'notification' : 'inApp',
        }),
    });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('成功', '个人资料已保存');
        // 更新本地用户信息
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            email: data.user.email,
            avatar: data.user.avatar,
            paymentQRCode: data.user.paymentQRCode,
            notificationPreference: data.user.notificationPreference || 'inApp',
          };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          setCurrentUser(updatedUser);
        }
      } else {
        Alert.alert('错误', data.message || '保存失败');
      }
    } catch (error) {
      console.error('保存资料失败:', error);
      Alert.alert('错误', '保存资料失败');
    } finally {
      setUploading(false);
    }
  };

  // 暂时禁用图片选择功能，避免因原生模块未正确链接导致闪退
  const pickImage = async () => {
    Alert.alert(
      '提示',
      '当前测试版本暂未启用图片上传功能，后续版本再开放。'
    );
  };

  const removeImage = (index) => {
    const newImages = [...proofImages];
    newImages.splice(index, 1);
    setProofImages(newImages);
  };

  const handleSubmitFeedback = async () => {
    const text = feedbackContent.trim();
    if (!text) {
      Alert.alert('提示', '请填写反馈内容');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      const actualToken = formatToken(token);
      if (!actualToken) {
        Alert.alert('提示', '请先登录');
        return;
      }
      setFeedbackSubmitting(true);
      const platform =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'android';
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${actualToken}`,
        },
        body: JSON.stringify({
          category: feedbackCategory,
          content: text,
          platform,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setFeedbackContent('');
        setShowFeedbackModal(false);
        Alert.alert('成功', '感谢您的反馈');
      } else {
        Alert.alert('提示', data.message || '提交失败');
      }
    } catch (e) {
      console.error('提交反馈失败:', e);
      Alert.alert('错误', '网络异常，请稍后重试');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleAddTag = async () => {
    const validation = validateTag({ name: newTagName, type: newTagType });
    if (!validation.valid) {
      Alert.alert('错误', validation.error);
      return;
    }

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName,
          type: newTagType,
          proofText,
          proofImages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 重新加载标签
        await loadTags();
        setNewTagName('');
        setNewTagType('custom');
        setProofText('');
        setProofImages([]);
        setShowAddTagModal(false);
        Alert.alert('成功', '标签已添加，等待审核');
      } else {
        Alert.alert('错误', data.message || '添加标签失败');
      }
    } catch (error) {
      console.error('添加标签错误:', error);
      Alert.alert('错误', '网络连接失败');
    } finally {
      setUploading(false);
    }
  };

  const loadTags = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/tags/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('加载标签错误:', error);
    }
  };

  const handleDeleteTag = (tagId) => {
    Alert.alert('确认删除', '确定要删除这个标签吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setTags(tags.filter(tag => tag.id !== tagId));
        },
      },
    ]);
  };

  const getTagIcon = (tag) => {
    if (tag.type === 'required') return '🏢';
    if (tag.type === 'optional') return '📚';
    return '🏷️';
  };

  const getTagTypeName = (tag) => {
    if (tag.type === 'required') return '现在单位';
    if (tag.type === 'optional') return '曾所属单位';
    return '自定义标签';
  };

  const getTagStyle = (tag) => {
    if (tag.level === 2) {
      return styles.tagVerified;
    }
    return styles.tagUnverified;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* 用户信息头部 */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <Image
            source={{
              uri:
                profileForm.avatarUrl ||
                'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
            }}
            style={styles.avatar}
          />
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {currentUser?.username || '我的'}
          </Text>
        </View>

        {/* 个人基础资料（邮箱、密码、头像等） */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>个人资料</Text>

          <Text style={[styles.label, { color: theme.colors.text }]}>用户名</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            value={currentUser?.username || ''}
            editable={false}
            placeholder="登录时填写的用户名"
            placeholderTextColor={theme.colors.placeholder}
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>真实姓名</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            value={currentUser?.realName || ''}
            editable={false}
            placeholder="登录/注册时填写的真实姓名"
            placeholderTextColor={theme.colors.placeholder}
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>身份证号</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            value={currentUser?.idCard || ''}
            editable={false}
            placeholder="登录/注册时填写的身份证号"
            placeholderTextColor={theme.colors.placeholder}
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>邮箱</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="请输入邮箱（可选）"
            placeholderTextColor={theme.colors.placeholder}
            value={profileForm.email}
            onChangeText={(text) =>
              setProfileForm((prev) => ({ ...prev, email: text }))
            }
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>密码</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="设置或修改密码（可选）"
            placeholderTextColor={theme.colors.placeholder}
            value={profileForm.password}
            onChangeText={(text) =>
              setProfileForm((prev) => ({ ...prev, password: text }))
            }
            secureTextEntry
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>头像地址（可选）</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="可粘贴一张头像图片的网络链接"
            placeholderTextColor={theme.colors.placeholder}
            value={profileForm.avatarUrl}
            onChangeText={(text) =>
              setProfileForm((prev) => ({ ...prev, avatarUrl: text }))
            }
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.colors.text, marginTop: 15 }]}>收款码设置</Text>
          <Text style={[styles.hintText, { color: theme.colors.secondaryText }]}>
            设置收款码后，其他用户付费提问时会显示您的收款码
          </Text>

          <Text style={[styles.label, { color: theme.colors.text }]}>微信收款码（图片URL）</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="请输入微信收款码图片的网络链接"
            placeholderTextColor={theme.colors.placeholder}
            value={profileForm.wechatQRCode}
            onChangeText={(text) =>
              setProfileForm((prev) => ({ ...prev, wechatQRCode: text }))
            }
            autoCapitalize="none"
          />
          {profileForm.wechatQRCode ? (
            <View style={styles.qrCodePreview}>
              <Image
                source={{ uri: profileForm.wechatQRCode }}
                style={styles.qrCodePreviewImage}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.colors.text }]}>支付宝收款码（图片URL）</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.inputBackground, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="请输入支付宝收款码图片的网络链接"
            placeholderTextColor={theme.colors.placeholder}
            value={profileForm.alipayQRCode}
            onChangeText={(text) =>
              setProfileForm((prev) => ({ ...prev, alipayQRCode: text }))
            }
            autoCapitalize="none"
          />
          {profileForm.alipayQRCode ? (
            <View style={styles.qrCodePreview}>
              <Image
                source={{ uri: profileForm.alipayQRCode }}
                style={styles.qrCodePreviewImage}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.profileSaveButton, { 
              backgroundColor: theme.colors.inputBackground,
              borderWidth: 1,
              borderColor: theme.colors.border
            }]}
            onPress={handleSaveProfile}
          >
            <Text style={[styles.profileSaveButtonText, { color: theme.colors.text }]}>保存资料（前端示意）</Text>
          </TouchableOpacity>
        </View>

        {/* 标签管理区域 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>身份标签</Text>
            <TouchableOpacity
              style={[styles.addButton, { 
                backgroundColor: '#1890FF',
                borderWidth: 0
              }]}
              onPress={() => setShowAddTagModal(true)}
            >
              <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>+ 添加标签</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <View key={tag._id || tag.id} style={[
                styles.tag,
                getTagStyle(tag),
                { 
                  backgroundColor: tag.level === 2 ? '#E6F7FF' : '#FFF7E6',
                  borderColor: tag.level === 2 ? '#91D5FF' : '#FFD591'
                }
              ]}>
                <View style={[
                  styles.tagLevelBadge, 
                  tag.level === 2 ? styles.tagLevelBadge2 : styles.tagLevelBadge1
                ]}>
                  <Text style={styles.tagLevelText}>{tag.level || 1}</Text>
                </View>
                <Text style={styles.tagIcon}>{getTagIcon(tag)}</Text>
                <View style={styles.tagContent}>
                  <Text style={[styles.tagName, { color: theme.colors.text }]}>{tag.name}</Text>
                  <Text style={[styles.tagType, { color: theme.colors.secondaryText }]}>{getTagTypeName(tag)}</Text>
                </View>
                {tag.level === 2 ? (
                  <Text style={[styles.verifiedBadge, { color: '#1890FF' }]}>✓ 已认证</Text>
                ) : (
                  <Text style={[styles.pendingBadge, { color: theme.colors.secondaryText }]}>待认证</Text>
                )}
                <TouchableOpacity
                  onPress={() => handleDeleteTag(tag.id)}
                  style={styles.deleteButton}
                >
                  <Text style={[styles.deleteText, { color: theme.colors.secondaryText }]}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={[styles.tipBox, { 
            backgroundColor: theme.colors.inputBackground,
            borderLeftColor: '#FFD700',
            borderWidth: 1,
            borderColor: theme.colors.border
          }]}>
            <Text style={[styles.tipTitle, { color: theme.colors.text }]}>💡 标签说明</Text>
            <Text style={[styles.tipText, { color: theme.colors.secondaryText }]}>
              • 必认证标签：现在单位（公司或学校），必须提交认证证明{'\n'}
              • 可认证标签：曾所属单位，可选认证{'\n'}
              • 自定义标签：用户自定义标签，可选认证{'\n'}
              • 已认证标签会显示 ✓ 标识，增加可信度
            </Text>
          </View>
        </View>

        {/* 实名认证状态提示（注册时已完成实名认证，这里只做展示） */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.statusBox, styles.statusBoxSuccess, {
            backgroundColor: theme.colors.inputBackground,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderLeftWidth: 3,
            borderLeftColor: '#FFD700'
          }]}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              {currentUser?.realName ? '✓ 已通过实名认证' : '实名认证信息'}
            </Text>
            <Text style={[styles.statusText, { color: theme.colors.secondaryText }]}>
              {currentUser?.realName && currentUser?.idCard
                ? '您在注册时已完成姓名和身份证号一致性校验。'
                : '注册新账号时将自动完成姓名和身份证号一致性校验。'}
            </Text>
          </View>
        </View>

        {/* 设置：通知方式 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>设置</Text>
          <Text style={[styles.label, { color: theme.colors.text }]}>通知方式</Text>
          <View style={styles.notificationOptions}>
            <TouchableOpacity
              style={[
                styles.notificationOption,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                profileForm.notificationPreference === 'inApp' && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary },
              ]}
              onPress={() => setProfileForm((p) => ({ ...p, notificationPreference: 'inApp' }))}
            >
              <Text style={[styles.notificationOptionText, { color: theme.colors.text }, profileForm.notificationPreference === 'inApp' && { color: theme.colors.primary, fontWeight: '600' }]}>
                仅页面内提示
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.notificationOption,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                profileForm.notificationPreference === 'notification' && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary },
              ]}
              onPress={() => setProfileForm((p) => ({ ...p, notificationPreference: 'notification' }))}
            >
              <Text style={[styles.notificationOptionText, { color: theme.colors.text }, profileForm.notificationPreference === 'notification' && { color: theme.colors.primary, fontWeight: '600' }]}>
                通知提示（系统通知栏/弹窗）
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.hintText, { color: theme.colors.secondaryText }]}>
            选择「通知提示」后，收到新消息或新提问时会弹出系统通知。请保存资料以生效。
          </Text>
        </View>

        {/* 其他功能区域 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          {/* 主题切换 */}
          <View style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={styles.menuIcon}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>
              {isDark ? '夜间模式' : '日间模式'}
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E0E0E0', true: theme.colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('QuestionHistory')}
          >
            <Text style={styles.menuIcon}>📝</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>付费提问记录</Text>
            <Text style={[styles.menuArrow, { color: theme.colors.secondaryText }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => setShowFeedbackModal(true)}
          >
            <Text style={styles.menuIcon}>💬</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>意见反馈</Text>
            <Text style={[styles.menuArrow, { color: theme.colors.secondaryText }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={styles.menuIcon}>💰</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>我的收入</Text>
            <Text style={[styles.menuArrow, { color: theme.colors.secondaryText }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={async () => {
              Alert.alert('确认退出', '确定要退出登录吗？', [
                { text: '取消', style: 'cancel' },
                {
                  text: '退出',
                  style: 'destructive',
                  onPress: async () => {
                    await AsyncStorage.removeItem('token');
                    await AsyncStorage.removeItem('user');
                    if (onLogout) {
                      onLogout();
                    }
                  },
                },
              ]);
            }}
          >
            <Text style={styles.menuIcon}>🚪</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>退出登录</Text>
            <Text style={[styles.menuArrow, { color: theme.colors.secondaryText }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 添加标签弹窗 */}
      <Modal
        visible={showAddTagModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddTagModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>添加标签</Text>

            <Text style={[styles.label, { color: theme.colors.text }]}>标签名称</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="请输入标签名称"
              placeholderTextColor={theme.colors.placeholder}
              value={newTagName}
              onChangeText={setNewTagName}
              maxLength={20}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>标签类型</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  newTagType === 'required' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setNewTagType('required')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    newTagType === 'required' && styles.typeButtonTextActive,
                  ]}
                >
                  现在单位
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  newTagType === 'optional' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setNewTagType('optional')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    newTagType === 'optional' && styles.typeButtonTextActive,
                  ]}
                >
                  曾所属单位
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  newTagType === 'custom' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setNewTagType('custom')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    newTagType === 'custom' && styles.typeButtonTextActive,
                  ]}
                >
                  自定义
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>认证证明（文字说明）</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
                color: theme.colors.text,
                minHeight: 80,
                textAlignVertical: 'top',
              }]}
              placeholder="请输入认证证明的文字说明（可选）"
              placeholderTextColor={theme.colors.placeholder}
              value={proofText}
              onChangeText={setProofText}
              multiline
              numberOfLines={4}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>认证证明（图片）</Text>
            <TouchableOpacity
              style={[styles.imagePickerButton, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
              }]}
              onPress={pickImage}
            >
              <Text style={[styles.imagePickerText, { color: theme.colors.text }]}>
                + 选择图片（最多5张）
              </Text>
            </TouchableOpacity>

            {proofImages.length > 0 && (
              <View style={styles.imagePreviewContainer}>
                {proofImages.map((uri, index) => (
                  <View key={index} style={styles.imagePreview}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.colors.inputBackground }]}
                onPress={() => {
                  setShowAddTagModal(false);
                  setNewTagName('');
                  setNewTagType('custom');
                  setProofText('');
                  setProofImages([]);
                }}
                disabled={uploading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: theme.colors.primary }, uploading && styles.submitButtonDisabled]}
                onPress={handleAddTag}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>添加</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => !feedbackSubmitting && setShowFeedbackModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>意见反馈</Text>

            <Text style={[styles.label, { color: theme.colors.text }]}>类型</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  feedbackCategory === 'bug' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setFeedbackCategory('bug')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    feedbackCategory === 'bug' && styles.typeButtonTextActive,
                  ]}
                >
                  问题
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  feedbackCategory === 'suggestion' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setFeedbackCategory('suggestion')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    feedbackCategory === 'suggestion' && styles.typeButtonTextActive,
                  ]}
                >
                  建议
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                  feedbackCategory === 'other' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setFeedbackCategory('other')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: theme.colors.secondaryText },
                    feedbackCategory === 'other' && styles.typeButtonTextActive,
                  ]}
                >
                  其他
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>内容</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
                color: theme.colors.text,
                minHeight: 100,
                textAlignVertical: 'top',
              }]}
              placeholder="请描述遇到的问题或建议（最多2000字）"
              placeholderTextColor={theme.colors.placeholder}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
              multiline
              maxLength={2000}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.colors.inputBackground }]}
                onPress={() => {
                  if (!feedbackSubmitting) setShowFeedbackModal(false);
                }}
                disabled={feedbackSubmitting}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: theme.colors.primary }, feedbackSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitFeedback}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>提交</Text>
                )}
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 10,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    marginBottom: 15,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  tagVerified: {
    backgroundColor: '#E6F7FF',
    borderColor: '#91D5FF',
  },
  tagUnverified: {
    backgroundColor: '#FFF7E6',
    borderColor: '#FFD591',
  },
  tagLevelBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tagLevelBadge1: {
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#FFD591',
  },
  tagLevelBadge2: {
    backgroundColor: '#E6F7FF',
    borderWidth: 1,
    borderColor: '#91D5FF',
  },
  tagLevelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  tagIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  tagContent: {
    flex: 1,
  },
  tagName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  tagType: {
    fontSize: 12,
  },
  verifiedBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  pendingBadge: {
    fontSize: 12,
    marginRight: 10,
  },
  deleteButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 20,
  },
  tipBox: {
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 8,
  },
  notificationOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  notificationOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  notificationOptionText: {
    fontSize: 14,
  },
  qrCodePreview: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  qrCodePreviewImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  menuArrow: {
    fontSize: 20,
  },
  // 弹窗样式
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonActive: {
  },
  typeButtonText: {
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  },
  cancelButton: {
  },
  submitButton: {
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  verifyButtonHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  statusBox: {
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  statusBoxSuccess: {
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
