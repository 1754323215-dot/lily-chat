import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo, onReset }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.error || '#ff4444' }]}>
        应用出现错误
      </Text>
      <Text style={[styles.message, { color: theme.colors.text }]}>
        {error?.message || '未知错误'}
      </Text>
      {__DEV__ && errorInfo && (
        <View style={[styles.errorInfo, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            {errorInfo.componentStack}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={onReset}
      >
        <Text style={styles.buttonText}>重试</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorInfo: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    maxHeight: 200,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ErrorBoundary;

