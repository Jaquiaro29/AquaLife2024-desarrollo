import React, { useState } from "react";

interface Producto {
  id: number;
  categoria: string;
  familia: string;
  nombre: string;
  neto: number;
  piezas: number;
  time: number;
}

const reverseData = (data: Producto[]): Producto[] => {
  return data.sort((a, b) => {
    const aInt = parseInt(a.time.toString());
    const bInt = parseInt(b.time.toString());
    if (aInt < bInt) return 1;
    if (aInt === bInt) return 0;
    return -1;
  });
};

const InventarioFisicoPage = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [resultNotFound, setResultNotFound] = useState(false);

  const handleOnSubmit = async (
    categoria: string,
    familia: string,
    nombre: string,
    neto: number,
    piezas: number
  ): Promise<void> => {
    const producto: Producto = {
      id: Date.now(),
      categoria,
      familia,
      nombre,
      neto,
      piezas,
      time: Date.now(),
    };

    const updatedProductos = [...productos, producto];

    setProductos(updatedProductos);
  };

  const openProducto = (producto: Producto): void => {
    console.log(producto);
  };

  const reverseProducts = reverseData(productos);

  const handleOnSearchInput = async (text: string): Promise<void> => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchQuery("");
      setResultNotFound(false);
      return;
    }
    const filteredProductos = productos.filter((producto) =>
      producto.familia.toLowerCase().includes(text.toLowerCase())
    );

    if (filteredProductos.length) {
      setProductos([...filteredProductos]);
    } else {
      setResultNotFound(true);
    }
  };

  const handleOnClear = async (): Promise<void> => {
    setSearchQuery("");
    setResultNotFound(false);
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex justify-center items-center mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleOnSearchInput(e.target.value)}
          placeholder="Search"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
        />
        <button
          onClick={() => setModalVisible(true)}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring focus:border-blue-500"
        >
          Add
        </button>
      </div>

      {resultNotFound ? (
        <div className="text-lg font-bold text-gray-500">Not Found</div>
      ) : (
        <div className="flex flex-col justify-center items-center">
          {reverseProducts.map((producto) => (
            <div
              key={producto.id}
              className="flex justify-center items-center mb-4"
            >
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
              <div className="ml-4">
                <div className="text-lg font-bold">{producto.nombre}</div>
                <div className="text-sm text-gray-500">
                  {producto.categoria} - {producto.familia}
                </div>
              </div>
              <button
                onClick={() => openProducto(producto)}
                className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring focus:border-blue-500"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}

      {modalVisible && (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-500 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-bold mb-2">Add Producto</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const categoria = (e.target as any).categoria.value;
                const familia = (e.target as any).familia.value;
                const nombre = (e.target as any).nombre.value;
                const neto = parseInt((e.target as any).neto.value);
                const piezas = parseInt((e.target as any).piezas.value);
                handleOnSubmit(categoria, familia, nombre, neto, piezas);
                setModalVisible(false);
              }}
            >
              <div className="mb-2">
                <label className="block text-sm font-bold mb-2">Categoria</label>
                <input
                  type="text"
                  name="categoria"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-bold mb-2">Familia</label>
                <input
                  type="text"
                  name="familia"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-bold mb-2">Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-bold mb-2">Neto</label>
                <input
                  type="number"
                  name="neto"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-bold mb-2">Piezas</label>
                <input
                  type="number"
                  name="piezas"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring focus:border-blue-500"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventarioFisicoPage;