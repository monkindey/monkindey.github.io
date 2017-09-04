## Mac配置php-fpm & nginx

### 前言

真心搞了很久呀呀

### 原理

首先了解原理, nginx配置如果是php后缀名的话就fastcgi_pass给localhost:9000端口,这个端口是php-fpm在监听, 然后解析之后再返回内容.

FastCGI是一个运行与HTTP Server和动态脚本语言间的接口。FastCGI采用的也是C/S方式, 跟服务器分开, 同时在脚本解析服务器上启动一个或多个守护进程。当HTTP服务器每次遇到动态程序时，可以将其直接交付给FastCGI进程来执行，然后将得到的结果返回给客户端。这个也是nginx的扩展性。

### 问题

然后一直不能成功, 不能跑php, 总是返回的是空白界面.

### 调试

* 是否nginx配置问题

     `nginx -t` 并不是

     > configuration file /usr/local/etc/nginx/nginx.conf test is successful

* 是否location问题

     ```bash
      location ~ \.php$ {
          return 200 'location 2';
      }
     ```
     有执行, 排除

* 是否include fastcgi.conf错了
     
     看了很多教程都是想要加上这个变量,  $document_root$fastcgi_script_name, 所以我就写到日志里看看它是不是跟我的预期是一样的呢.
      
      log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '$document_root$fastcgi_script_name'
                      '"$http_user_agent" "$http_x_forwarded_for"';

       access_log  /usr/local/var/log/nginx/access.log  main;

     确实没错, 跟我的预期是一样的, 这个时候在nginx log出现一个**Primary script unknown**问题, 感觉确实是一个突破点了,stackoverflow了一下确实解决这个问题了。感觉很多问题其实都是死在权限这个问题身上。主要的是php-fpm这个进程的权限不够导致的, 可以在php-fpm配置上修改。

     解决方案: https://serverfault.com/a/754378, 我机器上配置是在`/private/etc/php-fpm.conf`, 修改你user和group, 分别为自己的用户名和staff
        
       
### 其他问题

1. php-fpm执行的时候会出现 

    ```bash
    ERROR: failed to open configuration file '/private/etc/php-fpm.conf': No such file or directory (2)
    ERROR: failed to load configuration file '/private/etc/php-fpm.conf'
    ERROR: FPM initialization failed
    ```
    
    解决方案
    
    ```bash
    cp /private/etc/php-fpm.conf.default /private/etc/php-fpm.conf
    ```

2.  修改 php-fpm.conf error_log 配置为 /usr/local/var/log/php-fpm.log