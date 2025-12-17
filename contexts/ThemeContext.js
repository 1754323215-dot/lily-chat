import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// 主题颜色定义
export const lightTheme = {
  mode: 'light',
  colors: {
    background: '#F5F5F5',           // 主背景 - 浅灰色（类似QQ）
    secondaryBackground: '#EDEDED',  // 次级背景
    card: '#FFFFFF',                 // 卡片背景 - 纯白
    text: '#000000',                 // 主文字 - 纯黑
    secondaryText: '#8E8E93',        // 次要文字 - 中灰色
    border: '#E5E5E5',               // 边框 - 很浅的灰色
    primary: '#1890FF',              // 主题蓝色（类似QQ）
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBackground: '#F5F5F5',
    placeholder: '#AEAEB2',
  },
};

export const darkTheme = {
  mode: 'dark',
  colors: {
    background: '#000000',           // 主背景 - 纯黑(QQ)
    secondaryBackground: '#000000',  // 次级背景 - 纯黑
    card: '#1C1C1E',                 // 卡片背景 - 深灰(QQ)
    text: '#FFFFFF',                 // 主文字 - 纯白
    secondaryText: '#8E8E93',        // 次要文字 - 中灰
    border: '#2C2C2E',               // 边框 - 深灰
    primary: '#1890FF',              // 主题蓝 - 小面积点缀
    error: '#FF453A',                // 错误红 - 小面积点缀
    success: '#FFD700',              // 成功金 - 认证标识
    warning: '#FF9F0A',              // 警告橙 - 小面积点缀
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.8)',
    inputBackground: '#1C1C1E',      // 输入框背景 - 和卡片一样(QQ风格)
    placeholder: '#8E8E93',          // 占位符
    accent: '#FFD700',               // 强调色 - 金色
  },
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 从本地存储加载主题设置
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};
