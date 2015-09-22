/**
 * 感想：过度依赖jquery等库，$, on，很多原生的API不认识
 * 使用模板的重要性、reset.css, 正则表达式
 * 上下左右居中 DOM操作封装
 * 浏览器兼容、设备兼容(响应式)
 **/

(function() {
	var lecturerAbout = [{
		name: '张开涛',
		job: '京东服务端架构师',
		brief: '2014年加入京东,主要负责商品详情页、详情页统⼀服务架构与开发⼯作，设计并开发了多个亿级访问量系统。\
		工作之余喜欢写技术博客,有《跟我学Spring》、《跟我学Spring MVC》、《跟我学Shiro》、《跟我学Nginx+Lua开发》\
		等系列教程,目前博客访问量有460万+'
	}, {
		name: '张帅',
		job: 'working in Adobe',
		brief: ' He got master degree from University of California Irvine (UCI), majoring in networked \
		systems, and bachelor degree from Beijing University of Posts and Telecommunications (BUPT).\
		After graduation from UCI this spring of 2015, he joined Adobe to start career where he \
		got the chance to experience with Nginx and AWS stuff.'
	}, {
		name: 'Aapo Talvensaari',
		job: 'IT Manager, Aalto Capital, Finland',
		brief: 'Aapo Talvensaari has over twenty years of experiencein consulting, software development, and systemadministration.\
		These days his main areas of interest include web and cloud technologies.\
		He is an active community member of OpenResty project, and an author of several OpenResty components.\
		In his spare time he enjoys to spend his time at cottage, and be close to nature'
	}, {
		name: '章亦春',
		job: 'OpenResty 开源项⺫创建者',
		brief: '喜欢不务正业；Nginx 与 Systemtap 贡献者。以写程序为⽣，喜欢摆弄各种 UNIX风格的工具，\
		以及不同的编程语⾔，例如 C/C++、Lua、Perl、Python、Haskell 等等'
	}, {
		name: '朱德江',
		job: '广州酷狗ngx_lua实践者',
		brief: '五年前非常有幸在淘宝量子统计实习，能有机会近距离感受春哥和openresty的魅力。毕业后在北京一家创业公司，业余时间学习ngx_lua，应用openresty搞些兴趣项目。\
		两年前，来到了广州，将 openresty 应⽤于常规业务服务和核心基础服务。openresty社区尤其是春哥认真的回复，每次都让我收获许多；\
		我也能开始模仿着写些周边类库，resty-rsa，resty-kafka，希望能反馈社区，和大家一起玩得开心。'
	}, {
		name: '姚伟斌',
		job: '阿里云web平台组研发高级专家',
		brief: '现在正致力于通过阿里CDN让阿里云用户享受到稳定、快速、安全、低成本的内容分发服务。曾经就职于网易杭州研究院，开源软件开发\
		者与倡导者，开发多个知名Nginx模块，tengine核心开发人员，openresty的忠实⽤户。研究方向：高性能web服务器、cache服务器、网络加速、网络安全、大规模系统的运维自动化。'
	}, {
		name: '张聪',
		job: 'UPYUN系统开发工程师',
		brief: '目前主要负责 UPYUN CDN 相关的设计和开发⼯工作，兼部分 UPYUN 分布式存储系统相关的运维工作；\
		在 NGINX C 模块和 OpenResty / ngx_lua 模块的开发和维护方面有一些经验积累，同时热衷于推动公司内部的测试及运维自动化。偶尔会关注 C, Lua, Python, Erlang 相关的编程语\
		言社区，同时对 Redis, NGINX 源代码研究工作非常感兴趣，崇尚简单实用的工程实践'
	}];

	var byClass = function(className) {
		return document.getElementsByClassName(className);
	};

	var byId = function(id) {
		return document.getElementById(id);
	};

	var initPage = function() {
		var aboutHtml = byId('about-tmpl').innerHTML;
		var first = byClass('lecturer-list')[0];
		var event = new Event('click');

		first.dispatchEvent(event);
	};

	var about = byId('about');
	var lecturerList = byClass('lecturer-list')[0];
	var clicked = null;

	lecturerList.addEventListener('click', function(e) {
		var target = e.target;
		var index = target.getAttribute('data-index');
		var aboutHtml = byId('about-tmpl').innerHTML;

		if (index === null) {
			target = target.firstElementChild;
			index = 1;
		}

		aboutHtml = aboutHtml.replace(/{(\w+)}/g, function($1, $2) {
			return lecturerAbout[index - 1][$2];
		});

		if (clicked) {
			console.log(clicked);
			clicked.firstElementChild.style.display = 'none';
		}

		target.firstElementChild.style.display = 'inline-block';

		about.innerHTML = aboutHtml;
		clicked = target;
	}, false);

	initPage();

})()