# Logger flush / dispose 生命周期

## 为什么这也是知识点

这轮测试里暴露了一个很真实的问题：

```text
日志写完了，不代表文件资源已经释放。
```

特别是在 Windows 上，如果文件流还没关闭，临时目录删除会失败。

所以 logger 生命周期里要区分：

```text
flush
dispose
```

## flush 是什么

`flush` 的意思是：

```text
把缓冲区里的日志尽量刷出去
```

它解决的是：

```text
进程准备结束前，最后几条日志别丢
```

例如 Runtime 停止时：

```text
runtime.stop.done
```

这类收尾日志应该尽量落盘。

源码落点：

```text
src/runtime/runtime-bundle.ts
```

辅助函数：

```text
flushRuntimeLogger()
```

它只在 logger 支持 `flush()` 时调用。

## dispose 是什么

`dispose` 的意思是：

```text
刷出日志，并释放底层资源
```

对于 `ConsoleLogger` 来说，通常没什么资源要释放。

但对于 `PinoLogger` 来说，底层可能有：

```text
文件 stream
rotation stream
pino transport
pretty destination
```

这些资源如果不关，测试和长期服务都会留下尾巴。

源码落点：

```text
src/logging/pino-logger.ts
```

## 为什么 stop 和 dispose 分开

Runtime 里有两个阶段：

```text
stop
dispose
```

可以这样理解：

```text
stop    = 停止运行，但对象可能还存在
dispose = 彻底释放资源
```

所以 logger 的处理也对应：

```text
runtime.stop()
  -> flush logger

runtime.dispose()
  -> dispose logger
  -> 如果 logger 没有 dispose，就至少 flush
```

这符合生命周期语义。

## 这次修过的坑

之前全量测试出现过：

```text
ENOTEMPTY: directory not empty, rmdir temp logger dir
```

原因不是日志内容错了。

而是：

```text
pretty rotation 的底层文件流还没完全关闭
withTempDir 清理目录时文件句柄还在
```

解决方式是：

```text
PinoLogger 保存 destination
dispose 时先 flush
再关闭 destination
Runtime dispose 时调用 logger.dispose()
测试里对 PinoLogger 显式 dispose()
```

## 经验总结

`flush` 和 `dispose` 不能混为一谈。

```text
flush   = 数据完整性
dispose = 资源完整性
```

如果只是 CLI 短命令，也许感受不明显。

但在这些场景里很重要：

- 文件日志
- 日志轮转
- 长期运行 service
- Windows 文件句柄
- 测试临时目录
- 后续远端 transport

## 后续扩展

如果未来 logger 支持远端 transport，dispose 还可能需要：

```text
flush pending batch
关闭 HTTP client
关闭 socket
等待 worker thread 退出
```

所以从现在开始把生命周期留好，是对后面负责。

