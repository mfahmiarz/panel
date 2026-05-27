<?php
namespace Pterodactyl\Services\Bedrock\Config;
/**
 * NBT Reader for Minecraft Bedrock level.dat files.
 * Bedrock uses little-endian NBT format with an 8-byte header.
 */
class NbtReader
{
    private string $data;
    private int $offset = 0;
    public const TAG_END = 0;
    public const TAG_BYTE = 1;
    public const TAG_SHORT = 2;
    public const TAG_INT = 3;
    public const TAG_LONG = 4;
    public const TAG_FLOAT = 5;
    public const TAG_DOUBLE = 6;
    public const TAG_BYTE_ARRAY = 7;
    public const TAG_STRING = 8;
    public const TAG_LIST = 9;
    public const TAG_COMPOUND = 10;
    public const TAG_INT_ARRAY = 11;
    public const TAG_LONG_ARRAY = 12;
    public function __construct(string $data)
    {
        $this->data = $data;
        $this->offset = 0;
    }
    /**
     * Parse Bedrock level.dat file.
     * Bedrock level.dat has an 8-byte header before the NBT data.
     */
    public function parse(): array
    {
        $this->offset = 8;
        $tagType = $this->readByte();
        if ($tagType !== self::TAG_COMPOUND) {
            throw new \Exception('Invalid NBT: Root tag must be compound');
        }
        $name = $this->readString();
        $data = $this->readCompound();
        return [
            'name' => $name,
            'data' => $data,
        ];
    }
    private function readByte(): int
    {
        $value = ord($this->data[$this->offset]);
        $this->offset += 1;
        return $value;
    }
    private function readSignedByte(): int
    {
        $value = unpack('c', substr($this->data, $this->offset, 1))[1];
        $this->offset += 1;
        return $value;
    }
    private function readShort(): int
    {
        $value = unpack('v', substr($this->data, $this->offset, 2))[1];
        $this->offset += 2;
        if ($value >= 0x8000) {
            $value -= 0x10000;
        }
        return $value;
    }
    private function readInt(): int
    {
        $value = unpack('V', substr($this->data, $this->offset, 4))[1];
        $this->offset += 4;
        if ($value >= 0x80000000) {
            $value -= 0x100000000;
        }
        return $value;
    }
    private function readLong(): int
    {
        $value = unpack('P', substr($this->data, $this->offset, 8))[1];
        $this->offset += 8;
        return $value;
    }
    private function readFloat(): float
    {
        $value = unpack('g', substr($this->data, $this->offset, 4))[1];
        $this->offset += 4;
        return $value;
    }
    private function readDouble(): float
    {
        $value = unpack('e', substr($this->data, $this->offset, 8))[1];
        $this->offset += 8;
        return $value;
    }
    private function readString(): string
    {
        $length = $this->readShort();
        if ($length < 0) {
            $length = 0;
        }
        $value = substr($this->data, $this->offset, $length);
        $this->offset += $length;
        return $value;
    }
    private function readByteArray(): array
    {
        $length = $this->readInt();
        $value = [];
        for ($i = 0; $i < $length; $i++) {
            $value[] = $this->readSignedByte();
        }
        return $value;
    }
    private function readIntArray(): array
    {
        $length = $this->readInt();
        $value = [];
        for ($i = 0; $i < $length; $i++) {
            $value[] = $this->readInt();
        }
        return $value;
    }
    private function readLongArray(): array
    {
        $length = $this->readInt();
        $value = [];
        for ($i = 0; $i < $length; $i++) {
            $value[] = $this->readLong();
        }
        return $value;
    }
    private function readList(): array
    {
        $listType = $this->readByte();
        $length = $this->readInt();
        $value = [];
        for ($i = 0; $i < $length; $i++) {
            $value[] = $this->readTagValue($listType);
        }
        return [
            '_listType' => $listType,
            '_values' => $value,
        ];
    }
    private function readCompound(): array
    {
        $value = [];
        while (true) {
            $tagType = $this->readByte();
            if ($tagType === self::TAG_END) {
                break;
            }
            $name = $this->readString();
            $tagValue = $this->readTagValue($tagType);
            $value[$name] = [
                '_type' => $tagType,
                '_value' => $tagValue,
            ];
        }
        return $value;
    }
    private function readTagValue(int $tagType): mixed
    {
        return match ($tagType) {
            self::TAG_BYTE => $this->readSignedByte(),
            self::TAG_SHORT => $this->readShort(),
            self::TAG_INT => $this->readInt(),
            self::TAG_LONG => $this->readLong(),
            self::TAG_FLOAT => $this->readFloat(),
            self::TAG_DOUBLE => $this->readDouble(),
            self::TAG_BYTE_ARRAY => $this->readByteArray(),
            self::TAG_STRING => $this->readString(),
            self::TAG_LIST => $this->readList(),
            self::TAG_COMPOUND => $this->readCompound(),
            self::TAG_INT_ARRAY => $this->readIntArray(),
            self::TAG_LONG_ARRAY => $this->readLongArray(),
            default => throw new \Exception("Unknown tag type: {$tagType}"),
        };
    }
}
