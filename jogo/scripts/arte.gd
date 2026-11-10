extends RefCounted
## Carrega a arte de assets/sprites/<nome>.png.
## Se o PNG ainda nao existir, desenha um quadrado colorido no lugar.


static func caminho(nome: String) -> String:
	return "res://assets/sprites/%s.png" % nome


static func tem(nome: String) -> bool:
	return ResourceLoader.exists(caminho(nome))


## Sprite unico, centralizado e ajustado para caber em "tamanho".
static func visual(nome: String, cor: Color, tamanho: Vector2) -> Node2D:
	if tem(nome):
		var s := Sprite2D.new()
		s.texture = load(caminho(nome))
		var tam_tex: Vector2 = s.texture.get_size()
		var escala := minf(tamanho.x / tam_tex.x, tamanho.y / tam_tex.y)
		s.scale = Vector2(escala, escala)
		return s
	var p := Polygon2D.new()
	var m := tamanho / 2.0
	p.polygon = PackedVector2Array([
		Vector2(-m.x, -m.y), Vector2(m.x, -m.y), Vector2(m.x, m.y), Vector2(-m.x, m.y)
	])
	p.color = cor
	return p


## Textura repetida (chao, parede). Sem PNG, vira um xadrez de duas cores.
static func chao(nome: String, cor_a: Color, cor_b: Color, tamanho: Vector2) -> Sprite2D:
	var s := Sprite2D.new()
	if tem(nome):
		s.texture = load(caminho(nome))
	else:
		var img := Image.create(32, 32, false, Image.FORMAT_RGBA8)
		img.fill(cor_a)
		img.fill_rect(Rect2i(0, 0, 16, 16), cor_b)
		img.fill_rect(Rect2i(16, 16, 16, 16), cor_b)
		s.texture = ImageTexture.create_from_image(img)
	s.centered = false
	s.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	s.region_enabled = true
	s.region_rect = Rect2(Vector2.ZERO, tamanho)
	s.z_index = -10
	return s


## Bloco solido (parede, cerca, pilar) com colisao.
static func bloco(rect: Rect2, nome: String, cor_a: Color, cor_b: Color) -> StaticBody2D:
	var corpo := StaticBody2D.new()
	corpo.collision_layer = 1
	corpo.collision_mask = 0
	corpo.position = rect.position
	var forma := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = rect.size
	forma.shape = r
	forma.position = rect.size / 2.0
	corpo.add_child(forma)
	var vis := chao(nome, cor_a, cor_b, rect.size)
	vis.z_index = -5
	corpo.add_child(vis)
	return corpo
