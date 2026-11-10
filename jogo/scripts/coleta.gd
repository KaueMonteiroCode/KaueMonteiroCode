extends Area2D
## Item no chao (moeda ou semente). E puxado ate o jogador.

signal coletado(tipo: String, valor: int)

const Arte = preload("res://scripts/arte.gd")

var tipo := "moeda"
var valor := 1

var _pego := false
var _atraso := 0.3


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	var forma := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = 5.0
	forma.shape = c
	add_child(forma)
	var cor := Color(1, 0.85, 0.2) if tipo == "moeda" else Color(0.5, 1, 0.5)
	add_child(Arte.visual(tipo, cor, Vector2(7, 7)))
	body_entered.connect(_ao_tocar)


func _physics_process(delta: float) -> void:
	_atraso -= delta
	if _atraso > 0.0:
		return
	var j := get_tree().get_first_node_in_group("jogador") as Node2D
	if j == null:
		return
	# Sala limpa: tudo vem ate o jogador.
	var sala_limpa := get_tree().get_first_node_in_group("inimigos") == null
	if sala_limpa or global_position.distance_to(j.global_position) < 70.0:
		global_position = global_position.move_toward(j.global_position, 200.0 * delta)


func _ao_tocar(_corpo: Node2D) -> void:
	if _pego:
		return
	_pego = true
	coletado.emit(tipo, valor)
	queue_free()
