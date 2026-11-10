extends Area2D
## Tiro do jogador ou de inimigo.

const Arte = preload("res://scripts/arte.gd")

var direcao := Vector2.RIGHT
var velocidade := 200.0
var dano := 1
var do_jogador := true
var duracao := 2.0
var perfura := false  # atravessa inimigos (para nas paredes)
var raio := 3.0
var visual_nome := ""

var _usado := false


func configurar(pos: Vector2, dir: Vector2, vel: float, d: int, jogador: bool) -> void:
	position = pos
	direcao = dir.normalized()
	velocidade = vel
	dano = d
	do_jogador = jogador


func _ready() -> void:
	collision_layer = 0
	# paredes (1) + inimigos (4) ou jogador (2)
	collision_mask = 1 | (4 if do_jogador else 2)
	var forma := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = raio
	forma.shape = c
	add_child(forma)

	var nome := visual_nome
	if nome == "" or not Arte.tem(nome):
		nome = "tiro_jogador" if do_jogador else "tiro_inimigo"
	var cor := Color(1, 0.9, 0.3) if do_jogador else Color(1, 0.3, 0.5)
	var vis := Arte.visual(nome, cor, Vector2(raio, raio) * 2.0)
	vis.rotation = direcao.angle()
	add_child(vis)
	body_entered.connect(_ao_tocar)


func _physics_process(delta: float) -> void:
	position += direcao * velocidade * delta
	duracao -= delta
	if duracao <= 0.0:
		queue_free()


func _ao_tocar(corpo: Node2D) -> void:
	if _usado:
		return
	if corpo.has_method("receber_dano"):
		corpo.call("receber_dano", dano)
	if perfura and not (corpo is StaticBody2D):
		return
	_usado = true
	queue_free()
