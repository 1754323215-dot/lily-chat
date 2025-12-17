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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAG_TYPES, TAG_LEVELS, createTag, validateTag } from '../models/Tag';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../constants/config';

export default function ProfileScreen({ navigation, onLogout }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('unverified'); // unverified, pending, verified, rejected
  const [tags, setTags] = useState([]);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState('custom');
  const [proofText, setProofText] = useState('');
  const [proofImages, setProofImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: '',
    password: '',
    avatarUrl: '',
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
          password: '', // 出于安全考虑不回显密码
          avatarUrl: user.avatar || '',
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const handleSaveProfile = () => {
    // 这里只做前端展示，实际保存需要调用后端接口
    Alert.alert('提示', '个人资料保存逻辑尚未接入后端，可后续在服务器实现。');
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
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={styles.menuIcon}>💰</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>我的收入</Text>
            <Text style={[styles.menuArrow, { color: theme.colors.secondaryText }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={[styles.menuText, { color: theme.colors.text }]}>设置</Text>
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
