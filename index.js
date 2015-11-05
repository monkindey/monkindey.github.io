/**
 * @author monkindey
 * @date 2015.11.5
 */

! function() {
	var aboutMe = document.getElementById('about-me');
	var brief = 'my name is zhangkaihao'
	var words = brief.split('');
	var color = ['#0e96a2', '#67a61c', '#fff', '#fff', '#fff'];
	var word = '';

	console.log(words);

	function getWordColor(word) {
		var index = parseInt(Math.random() * 6) - 1;
		return '<span style="color:' + color[index] + '">' + word + '</span>';
	}

	// console.log(getWordColor('123'));

	setTimeout(function type() {
		if (words.length !== 0) {
			word = words.shift();
			aboutMe.innerHTML += getWordColor(word);
			setTimeout(type, 100)
		}
	}, 100)

}()