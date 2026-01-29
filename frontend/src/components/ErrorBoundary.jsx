import { Component } from "react";

/**
 * React 错误边界组件
 * 捕获组件树中的 JavaScript 错误，显示友好的错误 UI
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error) {
        // 更新 state 使下一次渲染能够显示降级后的 UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // 记录错误到控制台（生产环境可以发送到错误追踪服务）
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        // 重置错误状态
        this.setState({
            hasError: false,
            error: null
        });
    };

    render() {
        if (this.state.hasError) {
            // 自定义降级后的 UI
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <div className="error-icon">⚠️</div>
                        <h2>出错了</h2>
                        <p>应用遇到了一个错误，请尝试刷新页面或点击下方按钮重试。</p>
                        {this.state.error && (
                            <details className="error-details">
                                <summary>错误详情</summary>
                                <pre>{this.state.error.toString()}</pre>
                            </details>
                        )}
                        <div className="error-actions">
                            <button onClick={this.handleReset} className="retry-btn">
                                重试
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="reload-btn"
                            >
                                刷新页面
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
